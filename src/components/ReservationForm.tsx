// components/ReservationForm.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import DatePicker, { registerLocale, setDefaultLocale } from "react-datepicker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useHouse } from "@/context/HouseContext";
import { es } from 'date-fns/locale/es';

registerLocale('es', es);
setDefaultLocale('es');

/* ---------------- Types ---------------- */
interface HouseLight {
  id: string;
  name?: string;
  maxGuests?: number;
  images?: string[];
  type?: string;
  occupiedDates?: Record<string, boolean>;
  description?: string;
  pricePerNight?: Record<string, number>;
  specialPrices?: Record<string, number>;
  seasons?: Season[];
}

type Season = {
  name: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  weekdayPrices: Record<string, number>;
  specialPrices?: Record<string, number>;
};

interface ReservationFormProps {
  onReserve?: (houseId: string, startDate: Date, endDate: Date, guests: number) => void;
  showResults?: boolean;
}

/* ---------------- Config / constants ---------------- */
const DATE_WINDOW_DAYS = 14;
const MAX_AHEAD_DAYS = 365;
const getGlobalMaxDate = () => addDays(new Date(), MAX_AHEAD_DAYS);
export const EXTRA_GUEST_PRICE = 40;
const MAX_GUESTS_GLOBAL = 8;

/* ---------------- Helpers ---------------- */
function isDuoId(id?: string) {
  return !!id && id.includes("__");
}

function splitDuoId(id?: string): (string | undefined)[] {
  if (!id) return [undefined, undefined];
  if (!isDuoId(id)) return [id, undefined];
  const [a, b] = id.split("__");
  return [a || undefined, b || undefined];
}

function toDateOnly(value: any): Date | null {
  if (!value) return null;
  let d: Date;
  try {
    if (typeof value?.toDate === "function") d = value.toDate();
    else d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  } catch {
    return null;
  }
}

function dateIso(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateDDMMYYYY(d?: Date | null) {
  if (!d) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function rangeOverlapsOccupied(start: Date, end: Date, occupiedSet: Set<string>) {
  if (!start || !end) return false;
  let cur = new Date(start);
  while (cur < end) {
    if (occupiedSet.has(dateIso(cur))) return true;
    cur = addDays(cur, 1);
  }
  return false;
}

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

/* ---------------- Season & Price Logic ---------------- */
function findSeasonForDate(seasons: Season[], iso: string): Season | null {
  if (!Array.isArray(seasons)) return null;

  for (const season of seasons) {
    if (!season.start || !season.end) continue;
    if (season.start <= iso && iso <= season.end) {
      return season;
    }
  }
  return null;
}

function getPriceForDate(house: any, d: Date): number | null {
  if (!house) return null;

  const iso = dateIso(d);

  // 1) specialPrices global (máxima prioridad)
  if (house.specialPrices && typeof house.specialPrices[iso] === "number") {
    return house.specialPrices[iso];
  }

  // 2) Buscar season activa
  const activeSeason = findSeasonForDate(house.seasons || [], iso);

  if (activeSeason) {
    // 3) specialPrices dentro de la season
    if (activeSeason.specialPrices && typeof activeSeason.specialPrices[iso] === "number") {
      return activeSeason.specialPrices[iso];
    }

    // 4) weekdayPrices de la season
    const weekday = weekdayKey(d);
    if (activeSeason.weekdayPrices && typeof activeSeason.weekdayPrices[weekday] === "number") {
      return activeSeason.weekdayPrices[weekday];
    }
  }

  // 5) Fallback: pricePerNight global
  if (!house.pricePerNight) return null;
  const key = weekdayKey(d);
  const val = house.pricePerNight[key];
  return typeof val === "number" ? val : null;
}

/* ---------------- Firestore helpers ---------------- */
async function fetchReservations(houseId: string) {
  const reservationsRef = collection(db, "reservations");
  const q1 = query(reservationsRef, where("houseId", "==", houseId));
  const snap1 = await getDocs(q1);
  const q2 = query(reservationsRef, where("houseIds", "array-contains", houseId));
  const snap2 = await getDocs(q2);

  const mapByDocId = new Map<string, any>();
  for (const doc of snap1.docs) {
    mapByDocId.set(doc.id, doc.data());
  }
  for (const doc of snap2.docs) {
    mapByDocId.set(doc.id, doc.data());
  }

  return Array.from(mapByDocId.values());
}

function shouldIncludeReservation(res: any) {
  const status = String(res?.status ?? "").toLowerCase();
  return status === "admin" || status === "reserved" || status === "complete";
}

type HouseImage = { key: string; url: string; alt?: string };

const HOUSE_IMAGES: Record<string | number, HouseImage> = {
  "L0TeFf2LmrWGAaAyS8NY": { key: "L0TeFf2LmrWGAaAyS8NY", url: "./ezero-namelis/lake-house1.png", alt: "Alojamiento 1" },
  "PZwbfMYlSXj61uYYJutg": { key: "PZwbfMYlSXj61uYYJutg", url: "/dupleksas/1-dupleksas-n1.jpeg", alt: "Alojamiento 2" },
  "oDzv9346CdaAsok162sX": { key: "oDzv9346CdaAsok162sX", url: "/dupleksas/2-dupleksas-n1.jpeg", alt: "Alojamiento 3" },
};

function getHouseImage(houseId: string | number): HouseImage {
  return (
    HOUSE_IMAGES[houseId] ?? {
      key: `house-${houseId}`,
      url: "/images/houses/placeholder.jpg",
      alt: "Alojamiento",
    }
  );
}

/* ---------------- Component ---------------- */
export default function ReservationForm({ onReserve, showResults = true }: ReservationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState<number>(2);
  const [propertyType, setPropertyType] = useState<"todos" | "dupleksas" | "ezero namelis">("todos");
  const [openPicker, setOpenPicker] = useState<"arrival" | "departure" | null>(null);
  const [loading, setLoading] = useState(false);

  const [houses, setHouses] = useState<HouseLight[]>([]);
  const [openHouseId, setOpenHouseId] = useState<string | null>(null);
  const [lastApiResults, setLastApiResults] = useState<HouseLight[]>([]);

  const [occupiedDatesByHouse, setOccupiedDatesByHouse] = useState<Record<string, Set<string>>>({});
  const [carouselOffsetByHouse, setCarouselOffsetByHouse] = useState<Record<string, { arrival: number; departure: number }>>({});

  const [calendarModeByHouse, setCalendarModeByHouse] = useState<Record<string, "arrival" | "departure">>({});

  const resultsIndex: Record<string, HouseLight> = React.useMemo(() => {
    const idx: Record<string, HouseLight> = {};
    for (const h of houses) idx[h.id] = h;
    for (const h of lastApiResults) if (!idx[h.id]) idx[h.id] = h;
    return idx;
  }, [houses, lastApiResults]);

  function useHouseMerged(id?: string) {
    const ctx = useHouse(id as any);

    if (!id) return null;

    const fromResults = resultsIndex[id];

    if (ctx === undefined && !fromResults) return undefined as any;
    if (ctx === null && !fromResults) return null;

    const merged: any = { ...(fromResults || {}), ...(ctx || {}) };
    if (!merged.specialPrices && fromResults?.specialPrices) {
      merged.specialPrices = fromResults.specialPrices;
    }
    if (!merged.seasons && fromResults?.seasons) {
      merged.seasons = fromResults.seasons;
    }
    return merged;
  }

  const setOffset = (houseId: string, mode: "arrival" | "departure", newOffset: number) => {
    setCarouselOffsetByHouse((prev) => ({
      ...prev,
      [houseId]: {
        arrival: prev[houseId]?.arrival ?? 0,
        departure: prev[houseId]?.departure ?? 0,
        [mode]: newOffset,
      },
    }));
  };

  const [checkoutLoadingByHouse, setCheckoutLoadingByHouse] = useState<Record<string, boolean>>({});

  const bumpOffset = (houseId: string, mode: "arrival" | "departure", deltaDays: number = DATE_WINDOW_DAYS) => {
    setOffset(houseId, mode, getOffset(houseId, mode) + deltaDays);
  };

  const resetOffset = (houseId: string) => {
    setCarouselOffsetByHouse((prev) => ({
      ...prev,
      [houseId]: { arrival: 0, departure: 0 },
    }));
  };

  const didAutoSearchRef = useRef(false);

  useEffect(() => {
    const s = searchParams?.get("start");
    const e = searchParams?.get("end");
    const g = searchParams?.get("guests");
    const t = searchParams?.get("type");
    if (s && e && !didAutoSearchRef.current) {
      const sDate = new Date(s);
      const eDate = new Date(e);
      if (!Number.isNaN(sDate.getTime())) setStartDate(sDate);
      if (!Number.isNaN(eDate.getTime())) setEndDate(eDate);
      if (g) setGuests(parseInt(g, 10) || 2);
      if (t === "dupleksas" || t === "ezero namelis" || t === "todos") setPropertyType(t as any);
      didAutoSearchRef.current = true;
      setTimeout(() => searchHouses(sDate, eDate, g ? parseInt(g, 10) : undefined, t ? t : undefined), 0);
    }
  }, [searchParams]);

  const onChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
    if (start && !end) setOpenPicker("departure");
    else setOpenPicker(null);
    setTimeout(() => recomputeHousesAvailability(start, end), 0);
  };

  const handleGuestsChange = (inc: number) => {
    setGuests((prev) => {
      const next = Math.max(1, Math.min(MAX_GUESTS_GLOBAL, prev + inc));

      if (pathname === "/") {
        return next;
      }

      if (startDate && endDate) {
        if (lastApiResults && lastApiResults.length > 0) {
          void regenerateResultsForGuests(next, startDate, endDate, propertyType);
        } else {
          void searchHouses(startDate, endDate, next, propertyType);
        }
      } else {
        setHouses((prevHouses) => prevHouses.filter((h) => (h.maxGuests ?? 0) >= next));
        setTimeout(() => {
          recomputeHousesAvailability(startDate, endDate, undefined, undefined, next);
        }, 0);
      }

      return next;
    });
  };

  const setCheckoutLoading = (houseId: string, v: boolean) =>
    setCheckoutLoadingByHouse((p) => ({ ...p, [houseId]: v }));

  const createCheckoutAndRedirect = (
    houseIdOrSlug: string,
    s: Date,
    e: Date,
    guestsNum: number,
    houseSlug?: string
  ) => {
    setCheckoutLoading(houseIdOrSlug, true);

    const q = new URLSearchParams({
      houseId: houseIdOrSlug,
      houseSlug: houseSlug ?? "",
      start: s.toISOString(),
      end: e.toISOString(),
      guests: String(guestsNum),
    });

    router.push(`/checkout-details?${q.toString()}`);
    setCheckoutLoading(houseIdOrSlug, false);
  };

  const handleReserveClick = async (house: HouseLight) => {
    if (!isHouseAvailableNow(house)) return;

    const slug = slugify(house.name);
    if (!startDate || !endDate) {
      router.push(house.type === "dupleksas" ? `/dupleksas/${slug}` : `/${slug}`);
      return;
    }

    if (isDuoId(house.id) && guests > 4) {
      await createCheckoutAndRedirect(house.id, startDate, endDate, guests, slug);
      return;
    }

    const q = `start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}&guests=${encodeURIComponent(String(guests))}&type=${encodeURIComponent(house.type ?? '')}&house=${encodeURIComponent(slug)}`;
    if (onReserve) {
      onReserve(house.id, startDate, endDate, guests);
      return;
    }
    router.push(`${house.type === "dupleksas" ? `/dupleksas/${slug}` : `/${slug}`}?${q}`);
  };

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
      const data = await res.json();
      const apiResults = (data.results || []) as HouseLight[];
      setLastApiResults(apiResults);

      let results = apiResults.slice();

      if (effectiveGuests > 4 && effectiveType !== "ezero namelis") {
        const duplexes = apiResults.filter((r) => r.type === "dupleksas");
        const combos: HouseLight[] = [];
        for (let i = 0; i < duplexes.length; i++) {
          for (let j = i + 1; j < duplexes.length; j++) {
            const a = duplexes[i];
            const b = duplexes[j];
            const combo: HouseLight = {
              id: `${a.id}__${b.id}`,
              name: `${a.name ?? ""} + ${b.name ?? ""}`,
              maxGuests: (a.maxGuests ?? 0) + (b.maxGuests ?? 0),
              images: [...(a.images ?? []), ...(b.images ?? [])].slice(0, 6),
              type: "dupleksas",
              description: `${a.description ?? ""} / ${b.description ?? ""}`,
            };
            if ((combo.maxGuests ?? 0) >= effectiveGuests) combos.push(combo);
          }
        }
        results = [...results, ...combos];
      }

      results = results.filter((h) => (h.maxGuests ?? 0) >= effectiveGuests);

      setHouses(results);

      const occupiedSetsArray = await Promise.all(results.map((h) => fetchOccupiedDatesForHouse(h.id)));
      const occupiedMap: Record<string, Set<string>> = {};
      results.forEach((h, idx) => {
        occupiedMap[h.id] = occupiedSetsArray[idx] ?? new Set<string>();
      });

      setOccupiedDatesByHouse((prev) => ({ ...prev, ...occupiedMap }));

      recomputeHousesAvailability(sDate, eDate, results, { ...occupiedDatesByHouse, ...occupiedMap });
    } catch (err) {
      console.error("searchHouses error:", err);
      setHouses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOccupiedDatesForHouse = async (houseId?: string, force = false): Promise<Set<string>> => {
    if (!houseId) return new Set<string>();
    if (occupiedDatesByHouse[houseId] && !force) return occupiedDatesByHouse[houseId];

    try {
      const idsToQuery = isDuoId(houseId) ? houseId.split("__").filter(Boolean) : [houseId];

      const reservations: any[] = [];
      for (const id of idsToQuery) {
        if (!id) continue;
        const part = await fetchReservations(id);
        reservations.push(...part);
      }

      const perId: Record<string, Set<string>> = {};
      const addForId = (id: string, iso: string) => {
        if (!perId[id]) perId[id] = new Set<string>();
        perId[id].add(iso);
      };

      for (const res of reservations) {
        if (!shouldIncludeReservation(res)) continue;

        const checkIn = toDateOnly(res.checkIn);
        const checkOut = toDateOnly(res.checkOut);
        if (!checkIn || !checkOut) continue;

        const involvedIds = new Set<string>();
        if (Array.isArray(res.houseIds)) {
          res.houseIds.filter(Boolean).forEach((id: string) => involvedIds.add(id));
        }
        if (typeof res.houseId === "string" && res.houseId.includes("__")) {
          involvedIds.add(res.houseId);
        }

        let cur = new Date(checkIn);
        while (cur < checkOut) {
          const iso = dateIso(cur);
          for (const id of involvedIds) addForId(id, iso);
          cur = addDays(cur, 1);
        }
      }

      const unionForRequested = new Set<string>();
      if (occupiedDatesByHouse[houseId]) {
        occupiedDatesByHouse[houseId].forEach((d) => unionForRequested.add(d));
      }
      if (isDuoId(houseId)) {
        for (const id of houseId.split("__").filter(Boolean)) {
          perId[id]?.forEach((d) => unionForRequested.add(d));
        }
      }
      perId[houseId]?.forEach((d) => unionForRequested.add(d));

      setOccupiedDatesByHouse((prev) => {
        const next = { ...prev };
        const merge = (id: string, set: Set<string>) => {
          const base = new Set<string>(next[id] ?? []);
          set.forEach((d) => base.add(d));
          next[id] = base;
        };

        Object.entries(perId).forEach(([id, set]) => merge(id, set));
        merge(houseId, unionForRequested);

        return next;
      });

      return unionForRequested;
    } catch (err) {
      console.error("Error fetching reservations for house:", houseId, err);
      const empty = new Set<string>();
      setOccupiedDatesByHouse((prev) => ({ ...prev, [houseId]: empty }));
      return empty;
    }
  };

  const regenerateResultsForGuests = async (guestsCount: number, sDate?: Date | null, eDate?: Date | null, type?: string) => {
    const effectiveType = type ?? propertyType;
    const apiResults = lastApiResults ?? [];

    let results = apiResults.slice();

    if (guestsCount > 4 && effectiveType !== "ezero namelis") {
      const duplexes = apiResults.filter((r) => r.type === "dupleksas");
      const combos: HouseLight[] = [];
      for (let i = 0; i < duplexes.length; i++) {
        for (let j = i + 1; j < duplexes.length; j++) {
          const a = duplexes[i];
          const b = duplexes[j];
          const combo: HouseLight = {
            id: `${a.id}__${b.id}`,
            name: `${a.name ?? ""} + ${b.name ?? ""}`,
            maxGuests: (a.maxGuests ?? 0) + (b.maxGuests ?? 0),
            images: [...(a.images ?? []), ...(b.images ?? [])].slice(0, 6),
            type: "dupleksas",
            description: `${a.description ?? ""} / ${b.description ?? ""}`,
          };
          if ((combo.maxGuests ?? 0) >= guestsCount) combos.push(combo);
        }
      }
      results = [...results, ...combos];
    }

    results = results.filter((h) => (h.maxGuests ?? 0) >= guestsCount);

    setHouses(results);

    try {
      const occupiedSetsArray = await Promise.all(results.map((h) => fetchOccupiedDatesForHouse(h.id)));
      const occupiedMap: Record<string, Set<string>> = {};
      results.forEach((h, idx) => {
        occupiedMap[h.id] = occupiedSetsArray[idx] ?? new Set<string>();
      });

      setOccupiedDatesByHouse((prev) => ({ ...prev, ...occupiedMap }));

      recomputeHousesAvailability(sDate ?? startDate, eDate ?? endDate, results, { ...occupiedDatesByHouse, ...occupiedMap }, guestsCount);
    } catch (err) {
      console.error("regenerateResultsForGuests error:", err);
    }
  };

  const toggleOpenHouse = async (houseId: string) => {
    if (openHouseId === houseId) {
      setOpenHouseId(null);
      return;
    }
    setOpenHouseId(houseId);
    setCarouselOffsetByHouse((p) => {
      const cur = p[houseId] ?? { arrival: 0, departure: 0 };
      return { ...p, [houseId]: cur };
    });
    const setFetched = await fetchOccupiedDatesForHouse(houseId, true);
    recomputeHousesAvailability(startDate, endDate, houses, { ...occupiedDatesByHouse, [houseId]: setFetched });
  };

  const getOffset = (houseId: string, mode: "arrival" | "departure") => {
    const o = carouselOffsetByHouse[houseId];
    return o ? (o[mode] ?? 0) : 0;
  };

  function computeAvailabilityForHouse(
    house: HouseLight,
    sDate: Date | null,
    eDate: Date | null,
    occupiedMap: Record<string, Set<string>>,
    guestsOverride?: number
  ) {
    const guestsToUse = typeof guestsOverride === "number" ? guestsOverride : guests;
    const isCapacityOk = (house.maxGuests ?? 0) >= (guestsToUse ?? 0);
    if (!sDate || !eDate) return { ...house, isCapacityOk, isAvailable: false } as any;
    const occupiedSet = occupiedMap[house.id] ?? new Set<string>();
    const overlaps = rangeOverlapsOccupied(sDate, eDate, occupiedSet);
    return { ...house, isCapacityOk, isAvailable: !overlaps } as any;
  }

  function recomputeHousesAvailability(
    sDate: Date | null,
    eDate: Date | null,
    housesList?: HouseLight[],
    occupiedMapOverride?: Record<string, Set<string>>,
    guestsOverride?: number
  ) {
    const baseHouses = housesList ?? houses;
    const occupiedMap = occupiedMapOverride ?? occupiedDatesByHouse;
    const newHouses = baseHouses.map((h) =>
      computeAvailabilityForHouse(h, sDate, eDate, occupiedMap, guestsOverride)
    );
    setHouses(newHouses);
  }

  function isHouseAvailableNow(house: HouseLight) {
    if ((house as any).isAvailable !== undefined) return (house as any).isAvailable;
    if (!startDate || !endDate) return false;
    const occupiedSet = occupiedDatesByHouse[house.id] ?? new Set<string>();
    return !rangeOverlapsOccupied(startDate, endDate, occupiedSet);
  }

  const isBefore = (aIso: string, bIso: string) => new Date(aIso) < new Date(bIso);
  const isAfter = (aIso: string, bIso: string) => new Date(aIso) > new Date(bIso);

  const isOccupied = (houseId: string, iso: string) => {
    const s = occupiedDatesByHouse[houseId];
    return !!s && s.has(iso);
  };

  const handleSelectArrival = (houseId: string, d: Date) => {
    const iso = dateIso(d);
    if (isOccupied(houseId, iso)) return;

    const newStart = d;
    let newEnd = endDate;
    if (!endDate) {
      newEnd = addDays(d, 1);
    } else {
      const endIso = dateIso(endDate);
      if (!isBefore(iso, endIso)) {
        newEnd = addDays(d, 1);
      }
    }

    setStartDate(newStart);
    if (newEnd) setEndDate(newEnd);
    setTimeout(() => recomputeHousesAvailability(newStart, newEnd ?? endDate), 0);
  };

  const handleSelectDeparture = (houseId: string, d: Date) => {
    const iso = dateIso(d);

    // obtener el conjunto de fechas ocupadas (incluye combinaciones duo)
    const occupiedSet = occupiedDatesByHouse[houseId] ?? new Set<string>();
    const isOcc = occupiedSet.has(iso);
    const isPrevOcc = occupiedSet.has(dateIso(addDays(d, -1)));
    const isCheckinStart = isOcc && !isPrevOcc;

    // Si el día está ocupado y NO es inicio de check-in, no permitir selección
    if (isOcc && !isCheckinStart) return;

    // Si ya hay fecha de llegada, asegurarnos de que la salida sea posterior
    if (startDate) {
      const startIso = dateIso(startDate);
      if (!isAfter(iso, startIso)) return;
    }

    setEndDate(d);
    // Si no había fecha de llegada, fijamos la llegada al día anterior
    if (!startDate) setStartDate(addDays(d, -1));
    setTimeout(() => recomputeHousesAvailability(startDate, addDays(d, 0)), 0);
  };


  function slugify(name?: string) {
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

  /* ---------------- UI helpers (local price previews) ---------------- */
  function PriceBadgeLocal({ houseId, date }: { houseId: string; date: Date }) {
    const [idA, idB] = splitDuoId(houseId);
    const houseA: any = useHouseMerged(idA);
    const houseB: any = useHouseMerged(idB);

    if ((idA && houseA === undefined) || (idB && houseB === undefined))
      return <div className="text-xs opacity-60">...</div>;
    if ((idA && houseA === null) || (idB && houseB === null))
      return <div className="text-xs opacity-60">—</div>;

    const pA = houseA ? getPriceForDate(houseA, date) : null;
    const pB = houseB ? getPriceForDate(houseB, date) : null;
    if ((idA && pA === null) || (idB && pB === null)) return <div className="text-xs opacity-60">—</div>;

    const basePrice = (pA ?? 0) + (pB ?? 0);
    const includedBase = idB ? 4 : 2;
    const extraGuests = Math.max(0, guests - includedBase);
    const surcharge = extraGuests * EXTRA_GUEST_PRICE;
    const totalPrice = basePrice + surcharge;

    return (
      <div className="text-sm font-semibold">
        {totalPrice}€
        {surcharge > 0 && (
          <div className="text-xs text-gray-500">
            {basePrice}€ + {surcharge}€ ({extraGuests} extra)
          </div>
        )}
      </div>
    );
  }

  function getTotalPriceForRangeLocal(house: any, start: Date, end: Date, guestsCount: number) {
    if (!house) return null;
    let total = 0;
    let cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const endCopy = new Date(end);
    endCopy.setHours(0, 0, 0, 0);

    const extraGuests = Math.max(0, guestsCount - 2);
    const perNightSurcharge = extraGuests * EXTRA_GUEST_PRICE;

    while (cur < endCopy) {
      const p = getPriceForDate(house, cur);
      if (p === null) return null;
      total += p + perNightSurcharge;
      cur = addDays(cur, 1);
    }
    return total;
  }

  function RangePriceLocal({ houseId, startDate: sd, endDate: ed }: { houseId: string; startDate?: Date | null; endDate?: Date | null }) {
    const [idA, idB] = splitDuoId(houseId);
    const houseA: any = useHouseMerged(idA);
    const houseB: any = useHouseMerged(idB);

    if (!sd || !ed) return null;
    if ((idA && houseA === undefined) || (idB && houseB === undefined)) return <div className="text-sm opacity-60">Loading price…</div>;
    if ((idA && houseA === null) || (idB && houseB === null)) return <div className="text-sm opacity-60">Price not available</div>;

    const nights = Math.max(0, Math.round((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24)));
    if (nights <= 0) return null;

    if (idB) {
      let total: number | null = 0;
      let cur = new Date(sd); cur.setHours(0, 0, 0, 0);
      const endCopy = new Date(ed); endCopy.setHours(0, 0, 0, 0);

      const includedBase = 4;
      const extraGuests = Math.max(0, guests - includedBase);
      const perNightSurcharge = extraGuests * EXTRA_GUEST_PRICE;

      while (cur < endCopy) {
        const pa = getPriceForDate(houseA, cur);
        const pb = getPriceForDate(houseB, cur);
        if (pa === null || pb === null) { total = null; break; }
        total += pa + pb + perNightSurcharge;
        cur = addDays(cur, 1);
      }

      if (total === null) {
        return (
          <div className="mt-2 text-sm">
            <div className="font-medium">
              Price for {nights} night{nights > 1 ? "s" : ""}: <span className="font-semibold">Price varies</span>
            </div>
            <div className="mt-1 text-xs text-gray-600">Contact us for exact pricing or check the price for each night above.</div>
          </div>
        );
      }

      return (
        <div className="mt-3">
          <div className="text-sm font-medium">
            Total for {nights} night{nights > 1 ? "s" : ""}: <span className="font-semibold">{total}€</span>
          </div>
        </div>
      );
    }

    const house = houseA;
    if (!house) return <div className="text-sm opacity-60">Price not available</div>;
    const totalSingle = getTotalPriceForRangeLocal(house, sd, ed, guests);
    if (totalSingle === null) {
      return (
        <div className="mt-2 text-sm">
          <div className="font-medium">Price for {nights} night{nights > 1 ? "s" : ""}: <span className="font-semibold">Price varies</span></div>
          <div className="mt-1 text-xs text-gray-600">Contact us for exact pricing or check the price for each night above.</div>
        </div>
      );
    }

    return (
      <div className="mt-3">
        <div className="text-sm font-medium">Total for {nights} night{nights > 1 ? "s" : ""}: <span className="font-semibold">{totalSingle}€</span></div>
      </div>
    );
  }

  /* ---------------- Carousel rendering ---------------- */
  const renderCarouselForHouse = (house: HouseLight, mode: "arrival" | "departure") => {
    const houseId = house.id;
    const offset = getOffset(houseId, mode);
    const STEP = 7;

    const baseCandidate =
      mode === "departure" && endDate ? new Date(endDate) : (startDate ? new Date(startDate) : new Date());

    const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = (a: Date, b: Date) => Math.round((stripTime(a).getTime() - stripTime(b).getTime()) / msPerDay);

    const today = stripTime(new Date());
    const globalMax = stripTime(getGlobalMaxDate());

    const minAllowed = today;
    const maxAllowed = globalMax;

    const minForMode = mode === "departure" && startDate ? stripTime(new Date(startDate)) : minAllowed;

    const maxStartBaseCandidate = stripTime(addDays(maxAllowed, -(DATE_WINDOW_DAYS - 1)));
    const maxStartBase = maxStartBaseCandidate < minForMode ? minForMode : maxStartBaseCandidate;
    const minStartBase = minForMode;

    const allowedOffsetMin = diffDays(minStartBase, baseCandidate);
    const allowedOffsetMax = diffDays(maxStartBase, baseCandidate);

    const effectiveOffset = Math.min(Math.max(offset, allowedOffsetMin), allowedOffsetMax);

    const canPrev = effectiveOffset > allowedOffsetMin;
    const canNext = effectiveOffset < allowedOffsetMax;

    const goPrev = () => {
      if (!canPrev) return;
      const target = Math.max(effectiveOffset - STEP, allowedOffsetMin);
      setOffset(houseId, mode, target);
    };

    const goNext = () => {
      if (!canNext) return;
      const target = Math.min(effectiveOffset + STEP, allowedOffsetMax);
      setOffset(houseId, mode, target);
    };

    const base = addDays(baseCandidate, effectiveOffset);
    const finalBase = new Date(base);

    let days: Date[] = Array.from({ length: DATE_WINDOW_DAYS }).map((_, i) => addDays(finalBase, i));
    days = days.filter((d) => {
      const sd = stripTime(d);
      return sd.getTime() >= stripTime(minForMode).getTime() && sd.getTime() <= stripTime(maxAllowed).getTime();
    });

    const occupiedSet = occupiedDatesByHouse[houseId] ?? new Set<string>();

    return (
      <div className="w-full">
        {/* Header con navegación mejorada */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-200">
          <button
            onClick={goPrev}
            disabled={!canPrev}
            className={`group flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${!canPrev
              ? "opacity-30 cursor-not-allowed text-gray-400"
              : "hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-primary)] border-2 border-[var(--color-primary)]"
              }`}
            aria-label="Ver fechas anteriores"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Anterior</span>
          </button>

          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {mode === "arrival" ? "Mostrando fechas desde" : "Mostrando fechas desde"}
            </span>
            <span className="text-sm font-bold text-gray-700 mt-1">
              {formatDateDDMMYYYY(finalBase)}
            </span>
          </div>

          <button
            onClick={goNext}
            disabled={!canNext}
            className={`group flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${!canNext
              ? "opacity-30 cursor-not-allowed text-gray-400"
              : "hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-primary)] border-2 border-[var(--color-primary)]"
              }`}
            aria-label="Ver fechas siguientes"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Grid de días - Desktop */}
        <div className="hidden md:grid md:grid-cols-7 gap-3">
          {days.map((d) => {
            const ds = dateIso(d);
            const isOccupied = occupiedSet.has(ds);
            const isPrevOccupied = occupiedSet.has(dateIso(addDays(d, -1)));
            const isCheckinStart = isOccupied && !isPrevOccupied;
            const isCheckoutEnd = !isOccupied && isPrevOccupied;

            let disabled = false;
            let availabilityStatus = "";

            if (stripTime(d).getTime() < today.getTime()) {
              disabled = true;
              availabilityStatus = "Pasado";
            } else if (mode === "arrival" && isOccupied) {
              disabled = true;
              availabilityStatus = "Ocupado";
            } if (mode === "departure") {
              if (startDate) {
                const startDay = stripTime(new Date(startDate));
                if (stripTime(d).getTime() <= startDay.getTime()) {
                  disabled = true;
                  availabilityStatus = "No válido";
                }
              }
              // Solo deshabilitar si está ocupado Y NO es un día de check-in
              // (los días de check-in pueden ser días de check-out)
              if (isOccupied && !isCheckinStart) {
                disabled = true;
                availabilityStatus = "Ocupado";
              }
              // No hacer nada especial con isCheckinStart - debe quedar habilitado
            }

            if (!disabled) {
              if (mode === "arrival") {
                availabilityStatus = "✓ Check-in";
              } else if (isCheckinStart) {
                availabilityStatus = "✓ Check-out";
              } else {
                availabilityStatus = "✓ Check-out";
              }
            }

            const selectedArrival = startDate && dateIso(startDate) === ds;
            const selectedDeparture = endDate && dateIso(endDate) === ds;
            const inRange = startDate && endDate && dateIso(startDate) <= ds && ds <= dateIso(endDate);

            const paintAsOccupied =
              (mode === "arrival" && isOccupied) ||
              (mode === "departure" && ((isOccupied && !isCheckinStart) || isCheckoutEnd));

            let bgClass = "bg-white border-2 border-gray-200";
            let textClass = "text-gray-700";
            let statusClass = "text-gray-500";

            if (paintAsOccupied || (disabled && stripTime(d).getTime() >= today.getTime())) {
              bgClass = "bg-red-50 border-2 border-red-300";
              textClass = "text-red-600";
              statusClass = "text-red-500";
            } else if (selectedArrival || selectedDeparture) {
              bgClass = "bg-[var(--color-primary)] border-2 border-[var(--color-primary)]";
              textClass = "text-white";
              statusClass = "text-white";
            } else if (inRange) {
              bgClass = "bg-[var(--color-primary)]/10 border-2 border-[var(--color-primary)]/30";
              textClass = "text-[var(--color-primary-dark)]";
            } else if (!disabled) {
              bgClass = "bg-white border-2 border-gray-200 hover:border-[var(--color-primary)] hover:shadow-lg";
            }

            if (disabled && stripTime(d).getTime() < today.getTime()) {
              bgClass = "bg-gray-100 border-2 border-gray-200";
              textClass = "text-gray-400";
              statusClass = "text-gray-400";
            }

            return (
              <button
                key={ds}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  if (mode === "arrival") handleSelectArrival(houseId, d);
                  else handleSelectDeparture(houseId, d);
                }}
                className={`${bgClass} ${textClass} p-4 rounded-xl transition-all duration-200 ${!disabled ? "transform hover:scale-105 cursor-pointer" : "cursor-not-allowed opacity-60"
                  } flex flex-col items-center justify-between min-h-[140px]`}
              >
                {/* Día de la semana */}
                <div className="text-xs font-bold uppercase tracking-wider opacity-75">
                  {d.toLocaleString('es-ES', { weekday: 'short' })}
                </div>

                {/* Fecha */}
                <div className="text-2xl font-bold my-2">
                  {d.getDate()}
                </div>

                {/* Mes */}
                <div className="text-xs font-medium opacity-75 mb-2">
                  {d.toLocaleString('es-ES', { month: 'short' })}
                </div>

                {/* Precio */}
                <div className="mb-2">
                  <PriceBadgeLocal houseId={house.id} date={d} />
                </div>

                {/* Estado de disponibilidad */}
                <div className={`text-xs font-bold ${statusClass} text-center leading-tight`}>
                  {availabilityStatus}
                </div>
              </button>
            );
          })}
        </div>

        {/* Carrusel horizontal - Mobile */}
        <div className="md:hidden overflow-x-auto no-scrollbar -mx-6 px-6">
          <div className="inline-flex gap-3 py-2">
            {days.map((d) => {
              const ds = dateIso(d);
              const isOccupied = occupiedSet.has(ds);
              const isPrevOccupied = occupiedSet.has(dateIso(addDays(d, -1)));
              const isCheckinStart = isOccupied && !isPrevOccupied;
              const isCheckoutEnd = !isOccupied && isPrevOccupied;

              let disabled = false;
              let availabilityStatus = "";
              let statusIcon = "";

              if (stripTime(d).getTime() < today.getTime()) {
                disabled = true;
                availabilityStatus = "Pasado";
                statusIcon = "🚫";
              } else if (mode === "arrival" && isOccupied) {
                disabled = true;
                availabilityStatus = "Ocupado";
                statusIcon = "❌";
                // CÓDIGO EN DESKTOP - verificar alrededor línea 750
              } else if (mode === "departure") {
                if (startDate) {
                  const startDay = stripTime(new Date(startDate));
                  if (stripTime(d).getTime() <= startDay.getTime()) {
                    disabled = true;
                    availabilityStatus = "No válido";
                  }
                }
                if (isOccupied && !isCheckinStart) {
                  disabled = true;
                  availabilityStatus = "Ocupado";
                }
              }

              if (!disabled) {
                if (mode === "arrival") {
                  availabilityStatus = "Check-in";
                  statusIcon = "✓";
                } else if (isCheckinStart) {
                  availabilityStatus = "Check-out";
                  statusIcon = "✓";
                } else {
                  availabilityStatus = "Check-out";
                  statusIcon = "✓";
                }
              }

              const selectedArrival = startDate && dateIso(startDate) === ds;
              const selectedDeparture = endDate && dateIso(endDate) === ds;

              const paintAsOccupied =
                (mode === "arrival" && isOccupied) ||
                (mode === "departure" && (isOccupied && !isCheckinStart));

              let bgClass = "bg-white border-2 border-gray-300";
              let textClass = "text-gray-700";

              if (paintAsOccupied || (disabled && stripTime(d).getTime() >= today.getTime())) {
                bgClass = "bg-red-50 border-2 border-red-400";
                textClass = "text-red-600";
              } else if (selectedArrival || selectedDeparture) {
                bgClass = "bg-[var(--color-primary)] border-2 border-[var(--color-primary)]";
                textClass = "text-white";
              } else if (!disabled) {
                bgClass = "bg-white border-2 border-gray-300 active:border-[var(--color-primary)] active:shadow-lg";
              }

              if (disabled && stripTime(d).getTime() < today.getTime()) {
                bgClass = "bg-gray-100 border-2 border-gray-200";
                textClass = "text-gray-400";
              }

              return (
                <button
                  key={ds}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    if (mode === "arrival") handleSelectArrival(houseId, d);
                    else handleSelectDeparture(houseId, d);
                  }}
                  className={`${bgClass} ${textClass} min-w-[110px] p-4 rounded-xl transition-all duration-200 ${!disabled ? "active:scale-95" : "opacity-60"
                    } flex flex-col items-center justify-between shadow-sm`}
                >
                  {/* Día de la semana */}
                  <div className="text-xs font-bold uppercase tracking-wide opacity-75 mb-1">
                    {d.toLocaleString('es-ES', { weekday: 'short' })}
                  </div>

                  {/* Fecha completa */}
                  <div className="text-sm font-semibold mb-2">
                    {formatDateDDMMYYYY(d)}
                  </div>

                  {/* Precio */}
                  <div className="mb-3">
                    <PriceBadgeLocal houseId={house.id} date={d} />
                  </div>

                  {/* Estado con icono */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{statusIcon}</span>
                    <span className="text-xs font-bold">
                      {availabilityStatus}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Leyenda */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-4 justify-center text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[var(--color-primary)] rounded"></div>
              <span className="text-gray-600">Seleccionado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded"></div>
              <span className="text-gray-600">Disponible</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-50 border-2 border-red-300 rounded"></div>
              <span className="text-gray-600">No disponible</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="max-w-6xl w-full mx-auto">
      <div className="card-soft mt-6 sm:mt-16 p-6 md:p-8 flex flex-col items-center relative z-10">
        <div className="mb-4 z-10 relative w-full">
          <div className="sm:hidden flex justify-center">
            <label htmlFor="propertyTypeMobile" className="sr-only">Property type</label>
            <div className="relative w-40">
              <select
                id="propertyTypeMobile"
                value={propertyType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPropertyType(e.target.value as "todos" | "dupleksas" | "ezero namelis")}
                className="appearance-none w-full px-5 py-2 pr-10 rounded-full font-sans uppercase text-sm font-bold tracking-wide transition-colors border border-[var(--color-primary)] bg-[var(--color-background-card)] text-[var(--color-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-25"
              >
                <option value="todos">Todos</option>
                <option value="dupleksas">Duplex</option>
                <option value="ezero namelis">Lake House</option>
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M6 8l4 4 4-4" stroke="var(--color-primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="hidden sm:flex justify-center space-x-4">
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
        </div>

        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full justify-center items-center">
          <div className="flex flex-col text-left flex-1 border-r border-[var(--color-primary)] pr-4 w-full">
            <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Arrival</label>
            <DatePicker
              selected={startDate}
              onChange={onChange}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              minDate={new Date()}
              maxDate={getGlobalMaxDate()}
              open={openPicker === "arrival"}
              onInputClick={() => setOpenPicker("arrival")}
              onClickOutside={() => setOpenPicker(null)}
              customInput={
                <div className="p-2 bg-transparent text-[var(--color-text)] font-sans text-xl cursor-pointer">
                  {startDate ? formatDateDDMMYYYY(startDate) : 'DD/MM/YYYY'}
                </div>
              }
            />
          </div>

          <div className="flex flex-col text-left flex-1 border-r border-[var(--color-primary)] pr-4 w-full">
            <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Departure</label>
            <DatePicker
              selected={endDate}
              onChange={onChange}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              minDate={startDate || new Date()}
              maxDate={getGlobalMaxDate()}
              openToDate={startDate ?? new Date()}
              open={openPicker === "departure"}
              onInputClick={() => setOpenPicker("departure")}
              onClickOutside={() => setOpenPicker(null)}
              customInput={
                <div className="p-2 bg-transparent text-[var(--color-text)] font-sans text-xl cursor-pointer">
                  {endDate ? formatDateDDMMYYYY(endDate) : 'DD/MM/YYYY'}
                </div>
              }
            />
          </div>

          <div className="flex flex-col text-left flex-1 w-full">
            <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Guests</label>
            <div className="flex items-center justify-center p-2 bg-transparent text-[var(--color-text)] font-sans text-xl">
              <button onClick={() => handleGuestsChange(-1)} className="px-2 text-3xl leading-none text-[var(--color-text)] hover:text-[var(--color-primary-dark)]">-</button>
              <div className="w-12 text-center">{guests}</div>
              <button onClick={() => handleGuestsChange(1)} className="px-2 text-3xl leading-none text-[var(--color-text)] hover:text-[var(--color-primary-dark)]">+</button>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            if (!startDate || !endDate) { setOpenPicker('arrival'); return; }
            const q = `start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}&guests=${encodeURIComponent(String(guests))}&type=${encodeURIComponent(propertyType)}`;
            if (!showResults) {
              router.push(`/reservations?${q}`);
              return;
            }
            searchHouses();
          }}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-[var(--color-background-main)] font-bold py-3 px-8 rounded-md transition-colors w-full md:w-auto mt-4 md:mt-0 font-sans"
        >
          {loading ? 'Searching...' : 'Reserve'}
        </button>
      </div>

      <div className="mt-3 space-y-5">
        {showResults && houses.length === 0 && (
          <div className="text-center text-gray-600">No results. Select dates and click &quot;Check availability&quot;.</div>
        )}

        {houses.map((house) => {
          const img = getHouseImage(house.id);
          const isAvailable = isHouseAvailableNow(house);
          const isLoading = !!checkoutLoadingByHouse[house.id];
          const reserveButtonClass = isAvailable
            ? "bg-[var(--color-primary)] text-white hover:bg-opacity-90 transition duration-300"
            : "bg-gray-200 text-gray-500 cursor-not-allowed";

          return (
            <div key={house.id} className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl">
              <div className="flex flex-col md:flex-row">
                <div className="shrink-0 w-full md:w-80 lg:w-96">
                  <div className="w-full aspect-[4/3] md:h-full overflow-hidden">
                    <img
                      key={img.key}
                      src={img.url}
                      alt={img.alt ?? house.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
                    />
                  </div>
                </div>

                <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
                  <div>
                    <h3 className="text-3xl font-extrabold text-[var(--color-primary-dark)] leading-tight mb-2">
                      {house.name}
                    </h3>
                    <p className="text-base font-medium text-gray-500 mb-4">
                      Máximo de Huéspedes: {house.maxGuests}
                    </p>
                    <p className="text-gray-700 leading-relaxed text-lg mb-6 border-l-4 border-[var(--color-primary)] pl-4 italic">
                      {house.description}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {startDate ? (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 space-y-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Reservation fee</span>
                          </div>
                          <PriceBadgeLocal houseId={house.id} date={startDate} />
                        </div>

                        {endDate && (
                          <>
                            <div className="border-t border-gray-300"></div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wide">Total estancia</span>
                              </div>
                              <div className="text-2xl font-bold text-[var(--color-primary-dark)]">
                                <RangePriceLocal houseId={house.id} startDate={startDate} endDate={endDate} />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-2xl p-4 text-center">
                        <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-gray-500">Selecciona fechas para ver precios</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        disabled={!isAvailable || isLoading}
                        onClick={() => void handleReserveClick(house)}
                        className={`w-full sm:flex-1 py-3.5 px-6 rounded-xl font-bold uppercase tracking-wider text-sm transition-all duration-300 ${reserveButtonClass} ${isAvailable && !isLoading ? 'shadow-lg hover:shadow-xl transform hover:-translate-y-0.5' : ''}`}
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Procesando
                          </span>
                        ) : isAvailable ? (
                          "Reservar Ahora"
                        ) : (
                          "No Disponible"
                        )}
                      </button>

                      <button
                        onClick={() => toggleOpenHouse(house.id)}
                        className="w-full sm:flex-1 py-3.5 px-6 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-300 text-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {openHouseId === house.id ? "Cerrar" : "Ver Calendario"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {openHouseId === house.id && (
                <div className="p-6 md:p-8 bg-gradient-to-br from-gray-50 to-white border-t-4 border-[var(--color-primary)]">
                  <div className="max-w-5xl mx-auto">
                    {/* Tabs mejorados */}
                    <div className="flex gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                      <button
                        onClick={() => {
                          setCalendarModeByHouse((prev) => ({
                            ...prev,
                            [house.id]: "arrival"
                          }));
                        }}
                        className={`flex-1 py-3 px-3 sm:py-4 sm:px-6 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wide transition-all duration-200 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 ${(calendarModeByHouse[house.id] || "arrival") === "arrival"
                          ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white shadow-lg transform scale-105"
                          : "text-gray-600 hover:bg-gray-100"
                          }`}
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <div className="text-center sm:text-left">
                          <div className="leading-tight">Llegada</div>
                          {startDate && (
                            <div className="text-[10px] sm:text-xs font-normal mt-0.5 sm:mt-1 opacity-90 whitespace-nowrap">
                              {formatDateDDMMYYYY(startDate)}
                            </div>
                          )}
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setCalendarModeByHouse((prev) => ({
                            ...prev,
                            [house.id]: "departure"
                          }));
                        }}
                        className={`flex-1 py-3 px-3 sm:py-4 sm:px-6 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wide transition-all duration-200 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 ${calendarModeByHouse[house.id] === "departure"
                          ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white shadow-lg transform scale-105"
                          : "text-gray-600 hover:bg-gray-100"
                          }`}
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <div className="text-center sm:text-left">
                          <div className="leading-tight">Salida</div>
                          {endDate && (
                            <div className="text-[10px] sm:text-xs font-normal mt-0.5 sm:mt-1 opacity-90 whitespace-nowrap">
                              {formatDateDDMMYYYY(endDate)}
                            </div>
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Contenido del calendario */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-100">
                      {renderCarouselForHouse(house, calendarModeByHouse[house.id] || "arrival")}
                    </div>

                    {/* Información adicional */}
                    <div className="mt-4 text-center text-sm text-gray-600 bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <svg className="w-5 h-5 inline-block mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <strong>Consejo:</strong> Navega entre las fechas usando los botones &quot;Anterior&quot; y &quot;Siguiente&quot;. Los días marcados con ✓ están disponibles para reservar.
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}