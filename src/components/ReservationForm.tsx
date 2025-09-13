"use client";
import React, { useEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useHouse } from "@/context/HouseContext";

interface HouseLight {
  id: string;
  name: string;
  maxGuests: number;
  images?: string[];
  type?: string;
  occupiedDates?: Record<string, boolean>;
  description?: string;
}

interface Reservation {
  checkIn: any;
  checkOut: any;
  houseId: string;
}

interface ReservationFormProps {
  onReserve?: (houseId: string, startDate: Date, endDate: Date) => void;
  showResults?: boolean;
}

const DATE_WINDOW_DAYS = 14;
const EXTRA_GUEST_PRICE = 40; // € per extra person per night (applies starting from person 3)
const MAX_GUESTS_GLOBAL = 8;

function isDuoId(id: string) {
  return id.includes("__");
}
function splitDuoId(id: string) {
  if (!id) return [undefined, undefined] as (string | undefined)[];
  if (!isDuoId(id)) return [id, undefined];
  const [a, b] = id.split("__");
  return [a, b];
}

function toDateOnly(value: any): Date {
  if (!value) return new Date(0);
  let d: Date;
  if (typeof value?.toDate === "function") d = value.toDate();
  else d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}
function dateIso(d: Date) {
  return d.toISOString().split("T")[0];
}
function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function rangeOverlapsOccupied(start: Date, end: Date, occupiedSet: Set<string>) {
  let cur = new Date(start);
  while (cur < end) {
    if (occupiedSet.has(dateIso(cur))) return true;
    cur = addDays(cur, 1);
  }
  return false;
}

// small helper to convert weekday -> key used in pricePerNight
function weekdayKey(date: Date) {
  const map = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return map[date.getDay()];
}

function getPriceForDate(house: any, d: Date): number | null {
  if (!house || !house.pricePerNight) return null;
  const key = weekdayKey(d);
  const val = house.pricePerNight[key];
  return typeof val === "number" ? val : null;
}

// ----------------- NEW: functions that fetch reservations and produce occupied dates -----------------
async function fetchReservations(houseId: string) {
  const reservationsRef = collection(db, "reservations");
  const q = query(reservationsRef, where("houseId", "==", houseId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data());
}

function getOccupiedDatesFromReservations(reservations: any[]) {
  const occupiedSet = new Set<string>();

  reservations.forEach((res) => {
    const checkIn = toDateOnly(res.checkIn);
    const checkOut = toDateOnly(res.checkOut);
    let cur = new Date(checkIn);
    // treat checkOut as exclusive (typical booking semantics)
    while (cur < checkOut) {
      occupiedSet.add(dateIso(cur));
      cur.setDate(cur.getDate() + 1);
    }
  });

  return occupiedSet;
}

export default function ReservationForm({ onReserve, showResults = true }: ReservationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [propertyType, setPropertyType] = useState<"todos" | "dupleksas" | "ezero namelis">("todos");
  const [openPicker, setOpenPicker] = useState<"arrival" | "departure" | null>(null);
  const [loading, setLoading] = useState(false);
  const [houses, setHouses] = useState<HouseLight[]>([]);
  const [openHouseId, setOpenHouseId] = useState<string | null>(null);
  // occupiedDatesByHouse now always comes from Firestore reservations
  const [occupiedDatesByHouse, setOccupiedDatesByHouse] = useState<Record<string, Set<string>>>({});
  const [carouselOffsetByHouse, setCarouselOffsetByHouse] = useState<Record<string, number>>({});

  const didAutoSearchRef = useRef(false);

  useEffect(() => {
    const s = searchParams?.get("start");
    const e = searchParams?.get("end");
    const g = searchParams?.get("guests");
    const t = searchParams?.get("type");
    if (s && e && !didAutoSearchRef.current) {
      const sDate = new Date(s);
      const eDate = new Date(e);
      setStartDate(sDate);
      setEndDate(eDate);
      if (g) setGuests(parseInt(g, 10) || 2);
      if (t === "dupleksas" || t === "ezero namelis" || t === "todos") setPropertyType(t as any);
      didAutoSearchRef.current = true;
      setTimeout(() => searchHouses(sDate, eDate, g ? parseInt(g, 10) : undefined, t ? t : undefined), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
    if (start && !end) setOpenPicker("departure");
    else setOpenPicker(null);
    setTimeout(() => recomputeHousesAvailability(start, end), 0);
  };

  const handleGuestsChange = (inc: number) =>
    setGuests((p) => {
      const next = Math.max(1, p + inc);
      return Math.min(MAX_GUESTS_GLOBAL, next);
    });

  const searchHouses = async (sDateParam?: Date, eDateParam?: Date, guestsParam?: number, propertyTypeParam?: string) => {
    const sDate = sDateParam ?? startDate;
    const eDate = eDateParam ?? endDate;
    if (!sDate || !eDate) return;
    const effectiveGuests = typeof guestsParam === "number" ? guestsParam : guests;
    const effectiveType = propertyTypeParam ?? propertyType;

    setLoading(true);
    try {
      const res = await fetch("/api/reservations/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: sDate.toISOString(), endDate: eDate.toISOString(), guests: effectiveGuests, propertyType: effectiveType }),
      });
      // ---------------- CORRECCIÓN EN searchHouses ----------------
      const data = await res.json();
      const apiResults = (data.results || []) as HouseLight[]; // resultados tal cual vienen del API
      console.log("apiResults count:", apiResults.length, apiResults.map(r => ({ id: r.id, type: r.type, maxGuests: r.maxGuests })));

      // empezamos con una copia de los resultados sin filtrar por capacidad
      let results = apiResults.slice();

      // create combined duplex entries when user asks for >4 guests and type is dupleksas
      if (effectiveGuests > 4 && effectiveType === "dupleksas") {
        const duplexes = apiResults.filter((r) => r.type === "dupleksas"); // <-- usa apiResults, no results
        console.log("duplexes found for combos:", duplexes.map(d => ({ id: d.id, name: d.name })));
        const combos: HouseLight[] = [];
        for (let i = 0; i < duplexes.length; i++) {
          for (let j = i + 1; j < duplexes.length; j++) {
            const a = duplexes[i];
            const b = duplexes[j];
            const combo: HouseLight = {
              id: `${a.id}__${b.id}`, // composite id
              name: `${a.name} + ${b.name}`,
              maxGuests: (a.maxGuests ?? 0) + (b.maxGuests ?? 0),
              images: [...(a.images ?? []), ...(b.images ?? [])].slice(0, 6),
              type: "dupleksas",
              description: `${a.description ?? ""} / ${b.description ?? ""}`,
            };
            if ((combo.maxGuests ?? 0) >= effectiveGuests) combos.push(combo); // optional: evita combos que no cumplen capacidad
          }
        }
        console.log("combos created:", combos.map(c => ({ id: c.id, maxGuests: c.maxGuests })));
        results = [...results, ...combos];
      }

      // Ahora filtramos por capacidad usando la lista final (incluye combos)
      results = results.filter((h) => (h.maxGuests ?? 0) >= effectiveGuests);
      console.log("final results length (incl combos):", results.length, results.map(r => ({ id: r.id, maxGuests: r.maxGuests })));

      // Continúa con setHouses y fetchOccupiedDatesForHouse como antes
      setHouses(results);
      const fetchPromises = results.map((h) => fetchOccupiedDatesForHouse(h.id));
      await Promise.all(fetchPromises);
      recomputeHousesAvailability(sDate, eDate, results);

    } catch (err) {
      console.error(err);
      setHouses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOccupiedDatesForHouse = async (houseId: string, force = false) => {
    if (!houseId) return new Set<string>();
    if (occupiedDatesByHouse[houseId] && !force) return occupiedDatesByHouse[houseId];

    try {
      // support duo id like "idA__idB"
      const ids = isDuoId(houseId) ? houseId.split("__") : [houseId];
      const union = new Set<string>();
      // fetch reservations for each unit and union the occupied days
      for (const id of ids) {
        if (!id) continue;
        const reservations = await fetchReservations(id);
        const setOfDates = getOccupiedDatesFromReservations(reservations);
        setOfDates.forEach((d) => union.add(d));
      }
      setOccupiedDatesByHouse((prev) => ({ ...prev, [houseId]: union }));
      return union;
    } catch (err) {
      console.error("Error fetching reservations for house:", houseId, err);
      const empty = new Set<string>();
      setOccupiedDatesByHouse((prev) => ({ ...prev, [houseId]: empty }));
      return empty;
    }
  };


  const toggleOpenHouse = async (houseId: string) => {
    if (openHouseId === houseId) {
      setOpenHouseId(null);
      return;
    }
    setOpenHouseId(houseId);
    setCarouselOffsetByHouse((p) => ({ ...p, [houseId]: p[houseId] ?? 0 }));
    const setFetched = await fetchOccupiedDatesForHouse(houseId, true);
    recomputeHousesAvailability(startDate, endDate, houses, { ...occupiedDatesByHouse, [houseId]: setFetched });
  };

  const shiftCarousel = (houseId: string, days: number) => {
    setCarouselOffsetByHouse((p) => {
      const cur = p[houseId] ?? 0;
      return { ...p, [houseId]: cur + days };
    });
  };

  function computeAvailabilityForHouse(house: HouseLight, sDate: Date | null, eDate: Date | null, occupiedMap: Record<string, Set<string>>) {
    const isCapacityOk = (house.maxGuests ?? 0) >= (guests ?? 0);
    if (!sDate || !eDate) return { ...house, isCapacityOk, isAvailable: false };
    const occupiedSet = occupiedMap[house.id] ?? new Set<string>();
    const overlaps = rangeOverlapsOccupied(sDate, eDate, occupiedSet);
    return { ...house, isCapacityOk, isAvailable: !overlaps };
  }

  function recomputeHousesAvailability(sDate: Date | null, eDate: Date | null, housesList?: HouseLight[], occupiedMapOverride?: Record<string, Set<string>>) {
    const baseHouses = housesList ?? houses;
    const occupiedMap = occupiedMapOverride ?? occupiedDatesByHouse;
    const newHouses = baseHouses.map((h) => computeAvailabilityForHouse(h, sDate, eDate, occupiedMap));
    setHouses(newHouses);
  }

  function isHouseAvailableNow(house: HouseLight) {
    // Prefer the precomputed flag (set by recomputeHousesAvailability). If it's not present, compute
    // availability on the fly using occupiedDatesByHouse and the selected date range.
    if ((house as any).isAvailable !== undefined) return (house as any).isAvailable;
    if (!startDate || !endDate) return false;
    const occupiedSet = occupiedDatesByHouse[house.id] ?? new Set<string>();
    return !rangeOverlapsOccupied(startDate, endDate, occupiedSet);
  }

  const isOccupied = (houseId: string, iso: string) => {
    const s = occupiedDatesByHouse[houseId];
    return !!s && s.has(iso);
  };

  const isBefore = (aIso: string, bIso: string) => new Date(aIso) < new Date(bIso);
  const isAfter = (aIso: string, bIso: string) => new Date(aIso) > new Date(bIso);

  const handleSelectArrival = (houseId: string, d: Date) => {
    const iso = dateIso(d);
    if (isOccupied(houseId, iso)) return;
    if (endDate) {
      const endIso = dateIso(endDate);
      if (!isBefore(iso, endIso)) return;
    }
    setStartDate(d);
    if (!endDate) setEndDate(addDays(d, 1));
    setTimeout(() => recomputeHousesAvailability(addDays(d, 0), endDate), 0);
  };

  const handleSelectDeparture = (houseId: string, d: Date) => {
    const iso = dateIso(d);
    if (isOccupied(houseId, iso)) return;
    if (startDate) {
      const startIso = dateIso(startDate);
      if (!isAfter(iso, startIso)) return;
    }
    setEndDate(d);
    if (!startDate) setStartDate(addDays(d, -1));
    setTimeout(() => recomputeHousesAvailability(startDate, addDays(d, 0)), 0);
  };

  function slugify(name: string) {
    if (!name) return "";
    return encodeURIComponent(
      name
        .normalize("NFD")
        .replace(/[̀-\u036f]/g, "")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase()
    );
  }

  // ----- LOCAL UI helpers: PriceBadge + RangePrice (use useHouse to fetch full house doc) -----
  function PriceBadgeLocal({ houseId, date }: { houseId: string; date: Date }) {
    const [idA, idB] = splitDuoId(houseId);
    const houseA = useHouse(idA);
    const houseB = useHouse(idB);

    if ((idA && houseA === undefined) || (idB && houseB === undefined))
      return <div className="text-xs opacity-60">...</div>;
    if ((idA && houseA === null) || (idB && houseB === null)) return <div className="text-xs opacity-60">—</div>;

    // sum base prices (if house is missing price, treat as null -> show —)
    const pA = houseA ? getPriceForDate(houseA, date) : null;
    const pB = houseB ? getPriceForDate(houseB, date) : null;
    if ((idA && pA === null) || (idB && pB === null)) return <div className="text-xs opacity-60">—</div>;

    const basePrice = (pA ?? 0) + (pB ?? 0);

    // included base guests: 2 per unit
    const includedBase = (idB ? 4 : 2);
    const extraGuests = Math.max(0, guests - includedBase);
    const surcharge = extraGuests * EXTRA_GUEST_PRICE;
    const totalPrice = basePrice + surcharge;

    return (
      <div className="text-sm font-semibold">
        {totalPrice}€
        {surcharge > 0 && (
          <div className="text-xs text-gray-500">{basePrice}€ + {surcharge}€ ({extraGuests} extra)</div>
        )}
      </div>
    );
  }

  function getTotalPriceForRangeLocal(house: any, start: Date, end: Date, guestsCount: number) {
    if (!house) return null;
    // house might be a duo pseudo-object with pricePerNight undefined; this function used only when we have full house objects.
    if (!house.pricePerNight) return null;
    let total = 0;
    let cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const endCopy = new Date(end);
    endCopy.setHours(0, 0, 0, 0);

    const extraGuests = Math.max(0, guestsCount - 2); // note: this function was per single house usage
    const perNightSurcharge = extraGuests * EXTRA_GUEST_PRICE;

    while (cur < endCopy) {
      const p = getPriceForDate(house, cur);
      if (p === null) return null;
      total += p + perNightSurcharge;
      cur = addDays(cur, 1);
    }
    return total;
  }

  function RangePriceLocal({ houseId, startDate, endDate }: { houseId: string; startDate?: Date | null; endDate?: Date | null }) {
    const [idA, idB] = splitDuoId(houseId);
    const houseA = useHouse(idA);
    const houseB = useHouse(idB);

    if (!startDate || !endDate) return null;
    if ((idA && houseA === undefined) || (idB && houseB === undefined)) return <div className="text-sm opacity-60">Loading price…</div>;
    if ((idA && houseA === null) || (idB && houseB === null)) return <div className="text-sm opacity-60">Price not available</div>;

    const nights = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    if (nights <= 0) return null;

    // If duo, compute total by summing per-night prices of both houses
    if (idB) {
      let total: number | null = 0;
      let cur = new Date(startDate);
      cur.setHours(0, 0, 0, 0);
      const endCopy = new Date(endDate);
      endCopy.setHours(0, 0, 0, 0);

      const includedBase = 4; // 2 per unit
      const extraGuests = Math.max(0, guests - includedBase);
      const perNightSurcharge = extraGuests * EXTRA_GUEST_PRICE;

      while (cur < endCopy) {
        const pa = getPriceForDate(houseA, cur);
        const pb = getPriceForDate(houseB, cur);
        if (pa === null || pb === null) { total = null; break; }
        total! += pa + pb + perNightSurcharge;
        cur = addDays(cur, 1);
      }

      if (total === null) {
        return (
          <div className="mt-2 text-sm">
            <div className="font-medium">Price for {nights} night{nights > 1 ? "s" : ""}: <span className="font-semibold">Price varies</span></div>
            <div className="mt-1 text-xs text-gray-600">Contact us for exact pricing or check each night's price above.</div>
          </div>
        );
      }

      const firstNightBase = (getPriceForDate(houseA, startDate) ?? 0) + (getPriceForDate(houseB, startDate) ?? 0);
      const firstNight = firstNightBase + perNightSurcharge;

      return (
        <div className="mt-3">
          <div className="text-sm font-medium">Total for {nights} night{nights > 1 ? "s" : ""}: <span className="font-semibold">{total}€</span></div>

          <div className="mt-2 p-3 bg-white border rounded-md shadow-sm text-xs text-gray-700">
            <div className="font-semibold">Payment information</div>
            <div className="mt-1">Only the first night (<strong>{firstNight}€</strong>) will be charged now. Remaining (<strong>{total - firstNight}€</strong>) will be charged on arrival.</div>
            {perNightSurcharge > 0 && (
              <div className="mt-2 text-xs text-gray-500">Includes extra guest surcharge: {perNightSurcharge}€ per night ({Math.max(0, guests - 4)} extra guest{Math.max(0, guests - 4) > 1 ? 's' : ''}).</div>
            )}
          </div>
        </div>
      );
    }

    // fallback: single house logic (unchanged)
    const house = houseA;
    if (!house || !house.pricePerNight) return <div className="text-sm opacity-60">Price not available</div>;
    const totalSingle = getTotalPriceForRangeLocal(house, startDate, endDate, guests);
    if (totalSingle === null) {
      return (
        <div className="mt-2 text-sm">
          <div className="font-medium">Price for {nights} night{nights > 1 ? "s" : ""}: <span className="font-semibold">Price varies</span></div>
          <div className="mt-1 text-xs text-gray-600">Contact us for exact pricing or check each night's price above.</div>
        </div>
      );
    }
    const extraGuestsSingle = Math.max(0, guests - 2);
    const perNightSurchargeSingle = extraGuestsSingle * EXTRA_GUEST_PRICE;
    const firstNightBaseSingle = getPriceForDate(house, startDate) ?? 0;
    const firstNightSingle = firstNightBaseSingle + perNightSurchargeSingle;

    return (
      <div className="mt-3">
        <div className="text-sm font-medium">Total for {nights} night{nights > 1 ? "s" : ""}: <span className="font-semibold">{totalSingle}€</span></div>

        <div className="mt-2 p-3 bg-white border rounded-md shadow-sm text-xs text-gray-700">
          <div className="font-semibold">Payment information</div>
          <div className="mt-1">Only the first night (<strong>{firstNightSingle}€</strong>) will be charged now. Remaining (<strong>{totalSingle - firstNightSingle}€</strong>) will be charged on arrival.</div>
          {perNightSurchargeSingle > 0 && (
            <div className="mt-2 text-xs text-gray-500">Includes extra guest surcharge: {perNightSurchargeSingle}€ per night ({extraGuestsSingle} extra guest{extraGuestsSingle > 1 ? 's' : ''}).</div>
          )}
        </div>
      </div>
    );
  }


  // Render carousel with price badges
  const renderCarouselForHouse = (house: HouseLight, mode: "arrival" | "departure") => {
    const houseId = house.id;
    const offset = carouselOffsetByHouse[houseId] ?? 0;
    const base = startDate ? new Date(startDate) : new Date();
    if (mode === "departure" && endDate) base.setDate(endDate.getDate() + offset);
    else base.setDate(base.getDate() + offset);
    const days: Date[] = Array.from({ length: DATE_WINDOW_DAYS }).map((_, i) => addDays(base, i));
    const occupiedSet = occupiedDatesByHouse[houseId] ?? new Set<string>();

    return (
      <div className="w-full mt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-2 items-center text-sm text-gray-700">
            <button onClick={() => shiftCarousel(houseId, -7)} className="px-2 py-1 border rounded">◀</button>
            <div className="font-medium">{mode === "arrival" ? "Select arrival" : "Select departure"}</div>
          </div>
          <div>
            <button onClick={() => shiftCarousel(houseId, 7)} className="px-2 py-1 border rounded">▶</button>
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <div className="inline-flex gap-3 py-2">
            {days.map((d) => {
              const ds = dateIso(d);
              const occupied = occupiedSet.has(ds);
              let disabled = false;
              if (!isAfter(ds, dateIso(addDays(new Date(), -1)))) disabled = true;
              if (occupied) disabled = true;
              if (mode === "arrival") {
                if (endDate) {
                  const endIso = dateIso(endDate);
                  if (!isBefore(ds, endIso)) disabled = true;
                }
              } else {
                if (startDate) {
                  const startIso = dateIso(startDate);
                  if (!isAfter(ds, startIso)) disabled = true;
                }
              }
              const selectedArrival = startDate && dateIso(startDate) === ds;
              const selectedDeparture = endDate && dateIso(endDate) === ds;
              const inRange = startDate && endDate && dateIso(startDate) <= ds && ds <= dateIso(endDate);

              const classes = [
                "min-w-[96px] p-3 rounded-lg text-center border transition-transform transform hover:scale-105 flex flex-col items-center justify-between",
              ];
              if (occupied) classes.push("bg-red-600 text-white cursor-not-allowed");
              else if (selectedArrival || selectedDeparture) classes.push("bg-[var(--color-primary)] text-white");
              else if (inRange) classes.push("bg-[var(--color-primary)]/10");
              else classes.push("bg-white text-[var(--color-text)]");
              if (disabled && !occupied) classes.push("opacity-60 cursor-not-allowed");

              return (
                <button
                  key={ds}
                  className={classes.join(" ")}
                  onClick={() => {
                    if (occupied || disabled) return;
                    if (mode === "arrival") handleSelectArrival(houseId, d);
                    else handleSelectDeparture(houseId, d);
                  }}
                >
                  <div className="text-sm font-semibold">{d.getDate()}/{d.getMonth() + 1}</div>
                  <div className="text-xs text-gray-500">{d.toLocaleString(undefined, { weekday: "short" })}</div>
                  <div className="mt-2"><PriceBadgeLocal houseId={house.id} date={d} /></div>
                  <div className="text-xs mt-2">{occupied ? "Booked" : mode === "arrival" ? "Arrive" : "Depart"}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ---- Main render ----
  return (
    <div className="max-w-6xl w-full mx-auto">
      {/* Header area: compact search controls */}
      <div className="card-soft mt-16 p-6 md:p-8 flex flex-col items-center relative z-10">
        {/* Property Type Toggle */}
        <div className="flex justify-center space-x-4 mb-4 z-10 relative">
          <button
            onClick={() => setPropertyType('todos')}
            className={`px-6 py-2 rounded-full font-sans uppercase text-sm font-bold tracking-wide transition-colors ${propertyType === 'todos'
              ? 'bg-[var(--color-primary)] text-white'
              : 'border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:text-white'
              }`}
          >
            Todos
          </button>
          <button
            onClick={() => setPropertyType('dupleksas')}
            className={`px-6 py-2 rounded-full font-sans uppercase text-sm font-bold tracking-wide transition-colors ${propertyType === 'dupleksas'
              ? 'bg-[var(--color-primary)] text-white'
              : 'border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:text-white'
              }`}
          >
            Duplex
          </button>
          <button
            onClick={() => setPropertyType('ezero namelis')}
            className={`px-6 py-2 rounded-full font-sans uppercase text-sm font-bold tracking-wide transition-colors ${propertyType === 'ezero namelis'
              ? 'bg-[var(--color-primary)] text-white'
              : 'border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:text-white'
              }`}
          >
            Lake House
          </button>
        </div>

        {/* Dates & Guests */}
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full justify-center items-center">
          {/* Arrival Date */}
          <div className="flex flex-col text-left flex-1 border-r border-[var(--color-primary)] pr-4 w-full">
            <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Arrival</label>
            <DatePicker
              selected={startDate}
              onChange={onChange}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              minDate={new Date()}
              open={openPicker === "arrival"}
              onInputClick={() => setOpenPicker("arrival")}
              onClickOutside={() => setOpenPicker(null)}
              customInput={
                <div className="p-2 bg-transparent text-[var(--color-text)] font-sans text-xl cursor-pointer">
                  {startDate
                    ? startDate.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' })
                    : 'MM/DD'}
                </div>
              }
            />
          </div>

          {/* Departure Date */}
          <div className="flex flex-col text-left flex-1 border-r border-[var(--color-primary)] pr-4 w-full">
            <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Departure</label>
            <DatePicker
              selected={endDate}
              onChange={onChange}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              minDate={startDate || new Date()}
              open={openPicker === "departure"}
              onInputClick={() => setOpenPicker("departure")}
              onClickOutside={() => setOpenPicker(null)}
              customInput={
                <div className="p-2 bg-transparent text-[var(--color-text)] font-sans text-xl cursor-pointer">
                  {endDate
                    ? endDate.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' })
                    : 'MM/DD'}
                </div>
              }
            />
          </div>

          {/* Guests */}
          <div className="flex flex-col text-left flex-1 w-full">
            <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Guests</label>
            <div className="flex items-center justify-center p-2 bg-transparent text-[var(--color-text)] font-sans text-xl">
              <button
                onClick={() => handleGuestsChange(-1)}
                className="px-2 text-3xl leading-none text-[var(--color-text)] hover:text-[var(--color-primary-dark)]"
              >
                -
              </button>
              <div className="w-12 text-center">{guests}</div>
              <button
                onClick={() => handleGuestsChange(1)}
                className="px-2 text-3xl leading-none text-[var(--color-text)] hover:text-[var(--color-primary-dark)]"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Reserve Button */}
        <button
          onClick={() => {
            // abrir picker si no hay fechas
            if (!startDate || !endDate) { setOpenPicker('arrival'); return; }

            // construir query con los datos del header
            const q = `start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}&guests=${encodeURIComponent(String(guests))}&type=${encodeURIComponent(propertyType)}`;

            // si showResults === false, redirige a /reservations para que esa página (con showResults=true) haga la búsqueda
            if (!showResults) {
              router.push(`/reservations?${q}`);
              return;
            }

            // en caso contrario, realizar la búsqueda en el componente actual
            searchHouses();
          }} className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-[var(--color-background-main)] font-bold py-3 px-8 rounded-md transition-colors w-full md:w-auto mt-4 md:mt-0 font-sans"
        >
          {loading ? 'Searching...' : 'Reserve'}
        </button>
      </div>

      {/* Results list */}
      <div className=" mt-3 space-y-5">
        {showResults && houses.length === 0 && (
          <div className="text-center text-gray-600">No results. Select dates and click "Check availability".</div>
        )}

        {houses.map((house) => (
          <div key={house.id} className="bg-white rounded-lg shadow p-4 md:p-6 flex flex-col gap-4">
            {/* Left: main info */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-primary-dark)]">{house.name}</h3>
                  <p className="text-sm text-gray-600">Max guests: {house.maxGuests}</p>
                  <p className="mt-2 text-sm text-gray-700">{house.description}</p>

                  {/* Range total + payment notice moved here for clarity */}
                  {startDate && endDate && (
                    <div className="mt-4">
                      <RangePriceLocal houseId={house.id} startDate={startDate} endDate={endDate} />
                    </div>
                  )}
                </div>

                {/* Action column for larger view */}
                <div className="hidden md:flex flex-col items-end gap-3 w-48">
                  <div className="text-sm">
                    {/* show sample price for first night (if available) */}
                    {startDate ? <PriceBadgeLocal houseId={house.id} date={startDate} /> : <span className="text-xs text-gray-500">Select dates</span>}
                  </div>

                  <div className="w-full">
                    <button
                      disabled={!isHouseAvailableNow(house)}
                      onClick={() => {
                        if (!isHouseAvailableNow(house)) return;
                        const slug = slugify(house.name);
                        if (!startDate || !endDate) { router.push(house.type === "dupleksas" ? `/dupleksas/${slug}` : `/${slug}`); return; }
                        const q = `start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}&guests=${encodeURIComponent(String(guests))}&type=${encodeURIComponent(house.type!)}&house=${encodeURIComponent(slug)}`;
                        // prefer going to checkout if onReserve provided
                        if (onReserve) { onReserve(house.id, startDate, endDate); return; }
                        router.push(`${house.type === "dupleksas" ? `/dupleksas/${slug}` : `/${slug}`}?${q}`);
                      }}
                      className={`w-full py-2 rounded-md text-white ${isHouseAvailableNow(house) ? "bg-[var(--color-primary)] hover:opacity-95" : "bg-red-500 opacity-70 cursor-not-allowed"}`}>
                      {isHouseAvailableNow(house) ? "Reserve now" : "Unavailable"}
                    </button>

                    <button onClick={() => toggleOpenHouse(house.id)} className="mt-2 w-full py-2 border rounded">{openHouseId === house.id ? "Close dates" : "View dates"}</button>
                  </div>
                </div>
              </div>

              {/* Mobile actions (under info) */}
              <div className="mt-4 md:hidden flex items-center gap-3">
                <div className="flex-1">
                  {startDate ? <PriceBadgeLocal houseId={house.id} date={startDate} /> : <span className="text-xs text-gray-500">Select dates</span>}
                </div>
                <div className="w-48">
                  <button
                    disabled={!isHouseAvailableNow(house)}
                    onClick={() => {
                      if (!isHouseAvailableNow(house)) return;
                      const slug = slugify(house.name);
                      if (!startDate || !endDate) { router.push(house.type === "dupleksas" ? `/dupleksas/${slug}` : `/${slug}`); return; }
                      const q = `start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}&guests=${encodeURIComponent(String(guests))}&type=${encodeURIComponent(house.type!)}&house=${encodeURIComponent(slug)}`;
                      if (onReserve) { onReserve(house.id, startDate, endDate); return; }
                      router.push(`${house.type === "dupleksas" ? `/dupleksas/${slug}` : `/${slug}`}?${q}`);
                    }}
                    className={`w-full py-2 rounded-md text-white ${isHouseAvailableNow(house) ? "bg-[var(--color-primary)]" : "bg-red-500 opacity-70 cursor-not-allowed"}`}>
                    {isHouseAvailableNow(house) ? "Reserve now" : "Unavailable"}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: calendar panel */}
            <div className="w-full">
              <div className="p-3 border rounded">
                <div className="text-sm font-semibold mb-2">Availability</div>
                {openHouseId === house.id ? (
                  <>
                    {renderCarouselForHouse(house, "arrival")}
                    {renderCarouselForHouse(house, "departure")}
                  </>
                ) : (
                  <div></div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
