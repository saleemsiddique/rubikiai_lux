// components/ReservationForm.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { useHouse } from "@/context/HouseContext";
import { useTranslations, useLocale } from 'next-intl';
import { enUS } from 'date-fns/locale/en-US';
import { lt } from 'date-fns/locale/lt';
import { ru } from 'date-fns/locale/ru';

// Register all locales
registerLocale('en', enUS);
registerLocale('lt', lt);
registerLocale('ru', ru);

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

function stripTime(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function diffDays(a: Date, b: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const ad = stripTime(a).getTime();
  const bd = stripTime(b).getTime();
  return Math.round((ad - bd) / msPerDay);
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

  // 1) specialPrices global (highest priority)
  if (house.specialPrices && typeof house.specialPrices[iso] === "number") {
    return house.specialPrices[iso];
  }

  // 2) Find active season
  const activeSeason = findSeasonForDate(house.seasons || [], iso);

  if (activeSeason) {
    // 3) specialPrices within the season
    if (activeSeason.specialPrices && typeof activeSeason.specialPrices[iso] === "number") {
      return activeSeason.specialPrices[iso];
    }

    // 4) weekdayPrices from the season
    const weekday = weekdayKey(d);
    if (activeSeason.weekdayPrices && typeof activeSeason.weekdayPrices[weekday] === "number") {
      return activeSeason.weekdayPrices[weekday];
    }
  }

  // 5) Fallback: global pricePerNight
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
  "L0TeFf2LmrWGAaAyS8NY": { key: "L0TeFf2LmrWGAaAyS8NY", url: "/ezero-namelis/ezero-namelis (19).jpg", alt: "Accommodation 1" },
  "PZwbfMYlSXj61uYYJutg": { key: "PZwbfMYlSXj61uYYJutg", url: "/dupleksas/1-dupleksas10.jpeg", alt: "Accommodation 2" },
  "oDzv9346CdaAsok162sX": { key: "oDzv9346CdaAsok162sX", url: "/dupleksas/2-dupleksas8.jpeg", alt: "Accommodation 3" },
};

function getHouseImage(houseId: string | number): HouseImage {
  return (
    HOUSE_IMAGES[houseId] ?? {
      key: `house-${houseId}`,
      url: "/images/houses/placeholder.jpg",
      alt: "Accommodation",
    }
  );
}

/* ---------------- Component ---------------- */
export default function ReservationForm({ onReserve, showResults = true }: ReservationFormProps) {
  const t = useTranslations('reservations.form');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState<number>(1);
  const [propertyType, setPropertyType] = useState<"todos" | "dupleksas" | "ezero namelis">("todos");
  const [openPicker, setOpenPicker] = useState<"arrival" | "departure" | null>(null);
  const [loading, setLoading] = useState(false);

  const [houses, setHouses] = useState<HouseLight[]>([]);
  const [openHouseId, setOpenHouseId] = useState<string | null>(null);
  const [lastApiResults, setLastApiResults] = useState<HouseLight[]>([]);

  const [occupiedDatesByHouse, setOccupiedDatesByHouse] = useState<Record<string, Set<string>>>({});
  const [carouselOffsetByHouse, setCarouselOffsetByHouse] = useState<Record<string, { arrival: number; departure: number }>>({});

  const [calendarModeByHouse, setCalendarModeByHouse] = useState<Record<string, "arrival" | "departure">>({});
  // ---------- Mobile fullscreen calendar state ----------
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [mobileCalendarHouseId, setMobileCalendarHouseId] = useState<string | null>(null);
  const [mobileTouchStartX, setMobileTouchStartX] = useState<number | null>(null);
  const [mobileTouchDeltaX, setMobileTouchDeltaX] = useState<number>(0);

  // Estados para el calendario móvil
  const [selectedArrivalDates, setSelectedArrivalDates] = useState<Record<string, Date | null>>({});
  const [selectedDepartureDates, setSelectedDepartureDates] = useState<Record<string, Date | null>>({});
  const [occupiedArrivalByHouse, setOccupiedArrivalByHouse] = useState<Record<string, string[]>>({});
  const [occupiedDepartureByHouse, setOccupiedDepartureByHouse] = useState<Record<string, string[]>>({});

  // Update isMobile on resize (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 🔄 Sincronizar vista desktop/móvil cuando cambia el tamaño de pantalla
  useEffect(() => {
    if (isMobile) {
      // Si pasa a móvil: cerrar cualquier calendario abierto en desktop
      if (openHouseId) {
        setOpenHouseId(null);
      }
      // No abrir automáticamente el modal móvil: solo limpiar el estado
      setMobileCalendarHouseId(null);
    } else {
      // Si vuelve a desktop: cerrar el modal móvil si estaba abierto
      if (mobileCalendarHouseId) {
        setMobileCalendarHouseId(null);
      }
    }
  }, [isMobile]);

  const isReservations = pathname.startsWith("/reservations");
  const textColorClass = isReservations ? "text-black" : "text-white";

  // -------------------------------------------------------


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
      if (g) setGuests(parseInt(g, 10) || 1);
      if (t === "dupleksas" || t === "ezero namelis" || t === "todos") setPropertyType(t as any);
      didAutoSearchRef.current = true;
      setTimeout(() => searchHouses(sDate, eDate, g ? parseInt(g, 10) : undefined, t ? t : undefined), 0);
    }
  }, [searchParams]);

  const onChangeArrival = (date: Date | null) => {
    setStartDate(date);
    if (date) {
      // Si la fecha seleccionada es igual o mayor al endDate actual, resetear endDate
      if (endDate && date.getTime() >= endDate.getTime()) {
        setEndDate(null);
      }
      setOpenPicker("departure");
    }
    setTimeout(() => recomputeHousesAvailability(date, endDate), 0);
  };

  const onChangeDeparture = (date: Date | null) => {
    // No permitir que check-out sea igual a check-in
    if (date && startDate && date.getTime() === startDate.getTime()) {
      return;
    }
    setEndDate(date);
    if (date) {
      setOpenPicker(null);
    }
    setTimeout(() => recomputeHousesAvailability(startDate, date), 0);
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
      const res = await fetch(`/${locale}/api/reservations/availability`, {
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

  const toggleOpenHouse = async (houseId: string, preferredMode?: "arrival" | "departure") => {
    // Si ya estaba abierto en desktop, ciérralo.
    if (openHouseId === houseId && !isMobile) {
      setOpenHouseId(null);
      return;
    }

    // Para móvil: abrimos modal fullscreen
    if (isMobile) {
      // Si el modal ya estaba abierto para esta casa, ciérralo
      if (mobileCalendarHouseId === houseId) {
        setMobileCalendarHouseId(null);
        return;
      }
      // Abrimos modal
      setMobileCalendarHouseId(houseId);

      // Determinar modo inicial (arrival/departure)
      let mode: "arrival" | "departure" =
        preferredMode ??
        (startDate ? (endDate ? "arrival" : "departure") : "arrival");

      // Si sólo hay startDate y estamos en móvil preferimos abrir en departure
      if (!preferredMode && startDate && !endDate) mode = "departure";

      setCalendarModeByHouse((prev) => ({ ...prev, [houseId]: mode }));

      // Inicializar fechas seleccionadas para esta casa
      setSelectedArrivalDates(prev => ({ ...prev, [houseId]: startDate }));
      setSelectedDepartureDates(prev => ({ ...prev, [houseId]: endDate }));

      // Asegurar offsets iniciales
      setCarouselOffsetByHouse((p) => {
        const cur = p[houseId] ?? { arrival: 0, departure: 0 };
        return { ...p, [houseId]: cur };
      });

      // Forzamos fetch y calculamos fechas ocupadas
      const setFetched = await fetchOccupiedDatesForHouse(houseId, true);

      // Convertir Set a arrays para arrival y departure
      const occupiedArray = Array.from(setFetched);
      setOccupiedArrivalByHouse(prev => ({ ...prev, [houseId]: occupiedArray }));
      setOccupiedDepartureByHouse(prev => ({ ...prev, [houseId]: occupiedArray }));

      recomputeHousesAvailability(startDate, endDate, houses, { ...occupiedDatesByHouse, [houseId]: setFetched });

      return;
    }

    // Desktop behaviour (mantener lo actual)
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

  // Helper: addMonths
  function addMonths(d: Date, months: number) {
    const newDate = new Date(d);
    newDate.setMonth(newDate.getMonth() + months);
    return newDate;
  }

  // Helper: get weekday names based on locale
  const getWeekdayNames = (locale: string): string[] => {
    const weekdays: Record<string, string[]> = {
      en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      lt: ["Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk"],
      ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
    };
    return weekdays[locale] || weekdays.en;
  };

  // Helper: get locale string for date formatting
  const getLocaleString = (locale: string): string => {
    const localeMap: Record<string, string> = {
      en: "en-US",
      lt: "lt-LT",
      ru: "ru-RU",
    };
    return localeMap[locale] || "en-US";
  };

  function MobileCalendarMonthModal({ house }: { house: HouseLight }) {
    const safeHouse = house ?? ({ id: "unknown" } as HouseLight);
    const houseId = safeHouse.id;

    const mode = calendarModeByHouse[houseId] || 'arrival';
    const localStartDate = selectedArrivalDates[houseId] ?? null;
    const localEndDate = selectedDepartureDates[houseId] ?? null;

    const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
      const today = stripTime(new Date());
      if (mode === 'arrival') return localStartDate ? stripTime(new Date(localStartDate)) : today;
      else return localEndDate ? stripTime(new Date(localEndDate)) : localStartDate ? stripTime(new Date(localStartDate)) : today;
    });

    if (!house) return null;

    const today = stripTime(new Date());
    const maxMonth = new Date(today.getFullYear() + 1, today.getMonth(), 1);
    const firstDayOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);

    const days: (Date | null)[] = [];
    let firstWeekday = firstDayOfMonth.getDay();
    if (firstWeekday === 0) firstWeekday = 7;
    for (let i = 1; i < firstWeekday; i++) days.push(null);
    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
      days.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), d));
    }

    const occupiedArray = mode === 'arrival'
      ? (occupiedArrivalByHouse[houseId] ?? [])
      : (occupiedDepartureByHouse[houseId] ?? []);
    const occupiedSet = new Set(occupiedArray);

    const close = () => setMobileCalendarHouseId(null);

    const goPrevMonth = () => setVisibleMonth(addMonths(visibleMonth, -1));
    const goNextMonth = () => setVisibleMonth(prev => {
      const next = addMonths(prev, 1);
      return next > maxMonth ? prev : next;
    });

    const switchMode = (newMode: 'arrival' | 'departure') => {
      setCalendarModeByHouse(prev => ({ ...prev, [houseId]: newMode }));

      if (newMode === 'arrival' && localStartDate) {
        setVisibleMonth(stripTime(new Date(localStartDate)));
      } else if (newMode === 'departure' && localEndDate) {
        setVisibleMonth(stripTime(new Date(localEndDate)));
      }
    };

    // <-- Cambiado: ahora acepta opts.preserveDepartureIfSame -->
    const handleSelectArrival = (date: Date, opts?: { preserveDepartureIfSame?: boolean }) => {
      const iso = dateIso(date);
      if (occupiedSet.has(iso)) return;

      const occupiedSetFull = occupiedDatesByHouse[houseId] ?? new Set<string>();
      const newStart = date;
      let newEnd = localEndDate ? new Date(localEndDate) : null;

      // Si arrival coincide con departure → intentar mover departure UN DÍA (pero
      // comprobar la validez del día candidato COMO checkout, no como checkin)
      if (newEnd && dateIso(newEnd) === iso) {
        const candidate = addDays(newEnd, 1);

        // Comprobar validez del candidate COMO día de checkout
        const candidateDs = dateIso(candidate);
        const isOccCandidate = occupiedSetFull.has(candidateDs);
        const isPrevOccCandidate = occupiedSetFull.has(dateIso(addDays(candidate, -1)));
        const isCheckinStartCandidate = isOccCandidate && !isPrevOccCandidate;
        const isCheckoutEndCandidate = !isOccCandidate && isPrevOccCandidate;

        // Reglas de "checkout válido" (misma lógica que usas para departure mode)
        const candidateIsValidCheckout = !((isOccCandidate && !isCheckinStartCandidate) || isCheckoutEndCandidate);

        if (!candidateIsValidCheckout) {
          // Si NO es válido COMO checkout → no mover (comportamiento previo: eliminar checkout)
          newEnd = null;
          setSelectedDepartureDates(prev => ({ ...prev, [houseId]: null }));
          setEndDate(null);
        } else {
          // Si SÍ es válido COMO checkout → mover el checkout al día siguiente
          newEnd = candidate;
          setSelectedDepartureDates(prev => ({ ...prev, [houseId]: candidate }));
          setEndDate(candidate);
        }
      }


      // Validar rango arrival → departure
      if (newEnd) {
        let cur = stripTime(newStart);
        const end = stripTime(newEnd);
        while (cur < end) {
          if (occupiedSetFull.has(dateIso(cur))) {
            newEnd = null;
            setSelectedDepartureDates(prev => ({ ...prev, [houseId]: null }));
            setEndDate(null);
            break;
          }
          cur = addDays(cur, 1);
        }
      }

      // Si arrival > departure actual → deseleccionar departure
      if (newEnd && localEndDate && dateIso(newStart) > dateIso(localEndDate)) {
        newEnd = null;
        setSelectedDepartureDates(prev => ({ ...prev, [houseId]: null }));
        setEndDate(null);
      }

      setSelectedArrivalDates(prev => ({ ...prev, [houseId]: newStart }));
      setStartDate(newStart);

      recomputeHousesAvailability(newStart, newEnd);

      setTimeout(() => switchMode('departure'), 200);
    };

    const handleSelectDeparture = (date: Date) => {
      const iso = dateIso(date);
      const occupiedSetFull = occupiedDatesByHouse[houseId] ?? new Set<string>();
      const isOcc = occupiedSetFull.has(iso);
      const isPrevOcc = occupiedSetFull.has(dateIso(addDays(date, -1)));
      const isCheckinStart = isOcc && !isPrevOcc;
      const isCheckoutEnd = !isOcc && isPrevOcc;

      if ((isOcc && !isCheckinStart) || isCheckoutEnd) return;
      if (localStartDate && dateIso(date) <= dateIso(localStartDate)) return;

      setSelectedDepartureDates(prev => ({ ...prev, [houseId]: date }));
      setEndDate(date);

      setTimeout(() => {
        recomputeHousesAvailability(localStartDate, date);
      }, 0);
    };

    return (
      <div className="fixed inset-0 z-[2000] bg-black bg-opacity-60 flex items-end md:items-center justify-center">
        <div className="w-full h-[90vh] md:h-[80vh] bg-white rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl flex flex-col py-4 px-1">

          {/* Header de navegación */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={goPrevMonth} className="px-3 py-1 border rounded-full hover:bg-gray-100">‹</button>
            <div className="text-lg font-semibold">
              {visibleMonth.toLocaleString(getLocaleString(locale), { month: "long", year: "numeric" })}
            </div>
            <button
              onClick={goNextMonth}
              disabled={addMonths(visibleMonth, 1) > maxMonth}
              className={`px-3 py-1 border rounded-full hover:bg-gray-100 ${addMonths(visibleMonth, 1) > maxMonth ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              ›
            </button>
          </div>

          {/* Botones de modo */}
          <div className="flex justificentre mb-2 space-x-2">
            <button
              className={`px-3 py-1 rounded-full transition-all ${mode === 'arrival' ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-200'}`}
              onClick={() => switchMode('arrival')}
            >
              {t('checkIn')} {localStartDate && `(${formatDateDDMMYYYY(localStartDate)})`}
            </button>
            <button
              className={`px-3 py-1 rounded-full transition-all ${mode === 'departure' ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-200'}`}
              onClick={() => switchMode('departure')}
            >
              {t('checkOut')} {localEndDate && `(${formatDateDDMMYYYY(localEndDate)})`}
            </button>
          </div>

          {/* Días de la semana */}
          <div className="flex justify-between mb-2 text-xs font-semibold text-gray-500">
            {getWeekdayNames(locale).map(d => (
              <div key={d} className="w-[14.28%] text-center">{d}</div>
            ))}
          </div>

          {/* Grid de días */}
          <div className="flex-1 overflow-auto max-h-[60vh]">
            <div className="grid grid-cols-7 gap-1 relative px-5 py-2">
              {days.map((d, idx) => {
                if (!d) return <div key={idx} className="w-full h-20"></div>;

                const ds = dateIso(d);
                const occupiedSetFull = occupiedDatesByHouse[houseId] ?? new Set<string>();
                const isOccupied = occupiedSetFull.has(ds);
                const isPrevOccupied = occupiedSetFull.has(dateIso(addDays(d, -1)));
                const isCheckinStart = isOccupied && !isPrevOccupied;
                const isCheckoutEnd = !isOccupied && isPrevOccupied;

                // Verificar si es nuestra fecha seleccionada
                const isOurCheckin = localStartDate && dateIso(localStartDate) === ds;
                const isOurCheckout = localEndDate && dateIso(localEndDate) === ds;

                // Verificar si el check-in seleccionado está disponible
                const checkinDateStr = localStartDate ? dateIso(localStartDate) : null;
                const isCheckinAvailable = checkinDateStr ? !occupiedSetFull.has(checkinDateStr) : false;

                // NUEVA VALIDACIÓN: Verificar si el checkout está disponible en modo departure
                let isCheckoutValidInDepartureMode = false;
                if (isOurCheckout && localStartDate) {
                  const startDay = stripTime(new Date(localStartDate));
                  const checkoutDay = stripTime(d);

                  if (checkoutDay.getTime() > startDay.getTime()) {
                    let hasBlockingReservation = false;
                    for (let checkDate = addDays(startDay, 1); stripTime(checkDate).getTime() < checkoutDay.getTime(); checkDate = addDays(checkDate, 1)) {
                      if (occupiedSetFull.has(dateIso(checkDate))) {
                        hasBlockingReservation = true;
                        break;
                      }
                    }

                    const isOccupiedCheckout = occupiedSetFull.has(ds);
                    const isPrevOccupiedCheckout = occupiedSetFull.has(dateIso(addDays(d, -1)));
                    const isCheckinStartCheckout = isOccupiedCheckout && !isPrevOccupiedCheckout;
                    const isCheckoutEndCheckout = !isOccupiedCheckout && isPrevOccupiedCheckout;

                    const checkoutDayIsValid = !((isOccupiedCheckout && !isCheckinStartCheckout) || isCheckoutEndCheckout);

                    isCheckoutValidInDepartureMode = !hasBlockingReservation && checkoutDayIsValid;
                  }
                }

                const isPast = stripTime(d).getTime() < today.getTime();

                // Nuevo: visual vs real disabled
                let disabled = false; // real, no click
                let visuallyDisabled = false; // solo para apariencia
                let isBlockedByReservation = false;
                let isFirstAvailableCheckout = false;

                // Días pasados siempre bloqueados (real)
                if (isPast) {
                  disabled = true;
                }
                // Modo arrival: deshabilitar días ocupados (real), pero si es nuestro checkout válido -> solo visual
                else if (mode === 'arrival') {
                  if (isOurCheckout && isCheckinAvailable && isCheckoutValidInDepartureMode) {
                    visuallyDisabled = true; // apariencia deshabilitada, pero clickable
                  } else if (isOccupied) {
                    disabled = true;
                  }
                }
                // Modo departure: lógica especial (igual que antes)
                else if (mode === 'departure') {
                  if (localStartDate) {
                    const startDay = stripTime(new Date(localStartDate));
                    if (stripTime(d).getTime() <= startDay.getTime()) {
                      disabled = true;
                    }

                    let firstOccupiedAfterCheckin: Date | null = null;
                    const currentDay = addDays(startDay, 1);
                    const maxCheck = addDays(startDay, 365);

                    for (let checkDate = new Date(currentDay); checkDate <= maxCheck; checkDate = addDays(checkDate, 1)) {
                      const checkDateStr = dateIso(checkDate);
                      const isOccupiedCheck = occupiedSetFull.has(checkDateStr);
                      const isPrevOccupiedCheck = occupiedSetFull.has(dateIso(addDays(checkDate, -1)));
                      const isCheckinStartCheck = isOccupiedCheck && !isPrevOccupiedCheck;

                      if ((isOccupiedCheck && !isCheckinStartCheck) || (!isOccupiedCheck && isPrevOccupiedCheck)) {
                        firstOccupiedAfterCheckin = new Date(checkDate);
                        break;
                      }
                    }

                    if (firstOccupiedAfterCheckin && stripTime(d).getTime() > stripTime(firstOccupiedAfterCheckin).getTime()) {
                      disabled = true;
                      isBlockedByReservation = true;
                    }
                  }

                  if ((isOccupied && !isCheckinStart) || isCheckoutEnd) {
                    disabled = true;
                  }

                  if (localStartDate && !disabled && stripTime(d).getTime() > stripTime(new Date(localStartDate)).getTime()) {
                    let hasValidCheckout = false;

                    if (localEndDate && stripTime(localEndDate).getTime() > stripTime(new Date(localStartDate)).getTime()) {
                      const startDay = stripTime(new Date(localStartDate));
                      const endDay = stripTime(localEndDate);

                      let hasReservationBetween = false;
                      for (let checkDate = addDays(startDay, 1); stripTime(checkDate).getTime() < endDay.getTime(); checkDate = addDays(checkDate, 1)) {
                        if (occupiedSetFull.has(dateIso(checkDate))) {
                          hasReservationBetween = true;
                          break;
                        }
                      }
                      hasValidCheckout = !hasReservationBetween;
                    }

                    if (!hasValidCheckout) {
                      const startDay = stripTime(new Date(localStartDate));
                      const maxCheck = addDays(startDay, 365);

                      let firstBlockingDate: Date | null = null;
                      const currentDayForBlockingCheck = addDays(startDay, 1);

                      for (let checkDate = new Date(currentDayForBlockingCheck); checkDate <= maxCheck; checkDate = addDays(checkDate, 1)) {
                        const checkDateStr = dateIso(checkDate);
                        const isOccupiedCheck = occupiedSetFull.has(checkDateStr);
                        const isPrevOccupiedCheck = occupiedSetFull.has(dateIso(addDays(checkDate, -1)));
                        const isCheckinStartCheck = isOccupiedCheck && !isPrevOccupiedCheck;

                        if ((isOccupiedCheck && !isCheckinStartCheck) || (!isOccupiedCheck && isPrevOccupiedCheck)) {
                          firstBlockingDate = new Date(checkDate);
                          break;
                        }
                      }

                      let lastAvailableCheckout: Date | null = null;
                      if (firstBlockingDate) {
                        lastAvailableCheckout = addDays(firstBlockingDate, -1);
                      }
                      if (lastAvailableCheckout && stripTime(lastAvailableCheckout).getTime() <= stripTime(startDay).getTime()) {
                        lastAvailableCheckout = null;
                      }
                      if (lastAvailableCheckout && dateIso(d) === dateIso(lastAvailableCheckout)) {
                        isFirstAvailableCheckout = true;
                      }
                    }
                  }
                }

                // Determinar si este día debe mostrarse como seleccionado
                const isSelected =
                  (mode === "arrival" && isOurCheckin && !isOccupied) ||
                  (mode === "arrival" && isOurCheckout && isCheckinAvailable && isCheckoutValidInDepartureMode) ||
                  (mode === "departure" && isOurCheckin && !isOccupied) ||
                  (mode === "departure" && isOurCheckout && isCheckinAvailable && !isBlockedByReservation && !disabled);

                const isSelectedAndAvailable = isSelected && !isBlockedByReservation;

                // Solo dos colores: disponible o seleccionado (los disabled quedan en gris)
                let dayClass = "bg-white border-2 border-gray-200";
                let textClass = "text-gray-700";

                if (isPast) {
                  dayClass = "bg-gray-100 border-2 border-gray-200";
                  textClass = "text-gray-400";
                } else if (isSelectedAndAvailable) {
                  dayClass = "bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]/40";
                  textClass = "text-[var(--color-primary-dark)] font-bold";
                } else if ((disabled || visuallyDisabled) && !isPast) {
                  // Si es visual disabled o real disabled → aspecto atenuado
                  dayClass = "bg-gray-100 border-2 border-gray-300";
                  textClass = "text-gray-500";
                } else if (!disabled) {
                  dayClass = "bg-white border-2 border-gray-200";
                }

                // Manejo especial para el día de Check-out en modo arrival (mantenemos apariencia pero NO lo deshabilitamos realmente)
                if (mode === "arrival" && isOurCheckout && isCheckinAvailable && isCheckoutValidInDepartureMode) {
                  dayClass = "bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]/40";
                  textClass = "text-[var(--color-primary-dark)] font-bold";
                  // NOTA: ya establecimos visuallyDisabled arriba, no tocar 'disabled' para permitir click
                }

                // Determinar el label de selección
                let selectionLabel = "";
                let labelPosition = "-top-3"; // Posición por defecto

                if (isOurCheckin && isCheckinAvailable) {
                  selectionLabel = t('checkIn');
                  if (localEndDate && dateIso(addDays(d, 1)) === dateIso(localEndDate)) {
                    labelPosition = mode === 'arrival' ? "-top-3" : "bottom-7";
                  }
                } else if (isOurCheckout && isCheckinAvailable && isCheckoutValidInDepartureMode) {
                  selectionLabel = t('checkOut');
                  if (localStartDate && dateIso(addDays(d, -1)) === dateIso(localStartDate)) {
                    labelPosition = mode === 'arrival' ? "bottom-7" : "-top-3";
                  }
                }

                return (
                  <button
                    key={ds}
                    // SOLO deshabilitar realmente cuando `disabled === true`
                    disabled={disabled}
                    // aria-disabled refleja estado visual + real (mejora accesibilidad)
                    aria-disabled={disabled || visuallyDisabled}
                    onClick={() => {
                      // sólo bloqueo cuando es realmente disabled
                      if (disabled) return;

                      // comportamiento especial: si pinchas el día del checkout en modo arrival,
                      // solo moveremos el checkout UNICAMENTE si ESE DÍA está disponible para check-in.
                      if (mode === 'arrival' && localEndDate && dateIso(d) === dateIso(localEndDate)) {
                        const occupiedSetFull = occupiedDatesByHouse[houseId] ?? new Set<string>();
                        const isDayAvailableForCheckin = !occupiedSetFull.has(dateIso(d));

                        if (isDayAvailableForCheckin) {
                          // comportamiento antiguo: mover checkout al día siguiente si hace falta
                          handleSelectArrival(d);
                        } else {
                          // preserva el checkout en su sitio (no moverlo)
                          handleSelectArrival(d, { preserveDepartureIfSame: true });
                        }
                      } else {
                        if (mode === 'arrival') handleSelectArrival(d);
                        else handleSelectDeparture(d);
                      }
                    }}

                    className={`w-full h-20 p-1 rounded-lg flex flex-col items-center justify-between transition-all relative
                  ${dayClass} ${textClass} 
                  ${disabled ? "cursor-not-allowed opacity-60" : (visuallyDisabled ? "opacity-60 cursor-pointer" : "cursor-pointer active:scale-95")}
                  ${isFirstAvailableCheckout ? "animate-pulse-subtle" : ""}
                  ${selectionLabel ? "z-20" : "z-10"}
                `}
                  >

                    {/* Label de Check-in/Check-out */}
                    {selectionLabel && (
                      <div className={`absolute ${labelPosition} left-1/2 transform -translate-x-1/2 bg-[var(--color-primary)] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap z-30`}>
                        {selectionLabel}
                      </div>
                    )}

                    <div className="text-sm font-semibold">{d.getDate()}</div>
                    <div className="text-xs mt-1">
                      <PriceBadgeLocal houseId={house.id} date={d} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leyenda */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex flex-wrap gap-3 justify-center text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-white border-2 border-gray-200 rounded"></div>
                <span className="text-gray-600">{t('available')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]/40 rounded"></div>
                <span className="text-gray-600">{t('selected')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
                <span className="text-gray-600">{t('notAvailable')}</span>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-center items-center mt-4">
            <button
              onClick={() => {
                if (mode === 'arrival') {
                  switchMode('departure');
                } else {
                  close();
                }
              }}
              className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-full hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              {t('next')}
            </button>
          </div>
        </div>
      </div>
    );
  }


  const isBefore = (aIso: string, bIso: string) => new Date(aIso) < new Date(bIso);
  const isAfter = (aIso: string, bIso: string) => new Date(aIso) > new Date(bIso);

  const isOccupied = (houseId: string, iso: string) => {
    const s = occupiedDatesByHouse[houseId];
    return !!s && s.has(iso);
  };

  // Reemplaza tu función por esta
  const handleSelectArrival = (
    houseId: string,
    d: Date,
    opts?: { preserveDepartureIfSame?: boolean }
  ) => {
    const iso = dateIso(d);
    // Si el día está ocupado para ese house → nothing
    if (isOccupied(houseId, iso)) return;

    const occupiedSetFull = occupiedDatesByHouse[houseId] ?? new Set<string>();
    const strip = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());

    const newStart = d;
    let newEnd = endDate ? new Date(endDate) : null;

    // Helper: valida si una fecha candidate es válida COMO día de CHECK-OUT
    const candidateIsValidCheckout = (candidate: Date) => {
      const candDs = dateIso(candidate);
      const isOccCandidate = occupiedSetFull.has(candDs);
      const isPrevOccCandidate = occupiedSetFull.has(dateIso(addDays(candidate, -1)));
      const isCheckinStartCandidate = isOccCandidate && !isPrevOccCandidate;
      const isCheckoutEndCandidate = !isOccCandidate && isPrevOccCandidate;

      // mismo criterio usado en modo "departure"
      return !((isOccCandidate && !isCheckinStartCandidate) || isCheckoutEndCandidate);
    };

    // Caso A: arrival coincide con departure seleccionado
    if (newEnd && dateIso(newEnd) === dateIso(newStart)) {
      // Si nos piden preservar el departure, no intentamos moverlo
      if (!opts?.preserveDepartureIfSame) {
        const candidate = addDays(newEnd, 1);

        // Comprobar si el candidate es válido COMO checkout
        if (candidateIsValidCheckout(candidate)) {
          newEnd = candidate;
        } else {
          // Si no es válido COMO checkout → borrar checkout (comportamiento previo)
          newEnd = null;
        }
      } else {
        // preserveDepartureIfSame === true → NO tocar newEnd (se mantiene tal cual)
        newEnd = new Date(newEnd);
      }
    } else {
      // Caso B: arrival no coincide con departure
      // Si no había endDate → proponemos arrival + 1
      if (!newEnd) {
        const candidate = addDays(newStart, 1);
        // Validar como checkout antes de asignar
        if (candidateIsValidCheckout(candidate)) {
          newEnd = candidate;
        } else {
          newEnd = null;
        }
      } else {
        // Si arrival >= endDate (o same) → proponer arrival+1 (y validar como checkout)
        const endStripped = strip(newEnd);
        const startStripped = strip(newStart);
        if (startStripped.getTime() >= endStripped.getTime()) {
          const candidate = addDays(newStart, 1);
          if (candidateIsValidCheckout(candidate)) {
            newEnd = candidate;
          } else {
            newEnd = null;
          }
        } else {
          // arrival < endDate → mantener newEnd tal cual
          newEnd = new Date(newEnd);
        }
      }
    }

    // Actualizar estados globales y por house
    setStartDate(newStart);
    setSelectedArrivalDates?.(prev => ({ ...prev, [houseId]: newStart }));

    if (newEnd) {
      setEndDate(newEnd);
      setSelectedDepartureDates?.(prev => ({ ...prev, [houseId]: newEnd }));
    } else {
      setEndDate(null);
      setSelectedDepartureDates?.(prev => ({ ...prev, [houseId]: null }));
    }

    // Resetear offset para que el carousel/viewport muestre desde el inicio
    setOffset?.(houseId, "arrival", 0);

    // Cambiar a modo departure automáticamente (igual que antes)
    setCalendarModeByHouse((prev) => ({
      ...prev,
      [houseId]: "departure",
    }));

    // Refrescar disponibilidad/visualmente
    setTimeout(() => recomputeHousesAvailability(newStart, newEnd), 0);
  };


  const handleSelectDeparture = (houseId: string, d: Date) => {
    const iso = dateIso(d);

    // get occupied dates set (includes duo combinations)
    const occupiedSet = occupiedDatesByHouse[houseId] ?? new Set<string>();
    const isOcc = occupiedSet.has(iso);
    const isPrevOcc = occupiedSet.has(dateIso(addDays(d, -1)));
    const isCheckinStart = isOcc && !isPrevOcc;
    const isCheckoutEnd = !isOcc && isPrevOcc;

    // If the day is occupied and NOT a check-in start, don't allow selection
    if (isOcc && !isCheckinStart) return;

    // Don't allow selecting a day that is a checkout end (day after an occupied day)
    if (isCheckoutEnd) return;

    // If there's already an arrival date, ensure departure is after
    if (startDate) {
      const startIso = dateIso(startDate);
      if (!isAfter(iso, startIso)) return;
    }

    setEndDate(d);

    // 🔹 Recompute availability with the new departure date
    setTimeout(() => recomputeHousesAvailability(startDate, d), 0);
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
    if ((idA && houseA === undefined) || (idB && houseB === undefined)) return <div className="text-sm opacity-60">{t('loadingPrice')}</div>;
    if ((idA && houseA === null) || (idB && houseB === null)) return <div className="text-sm opacity-60">{t('priceNotAvailable')}</div>;

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
              {t('priceForNights', { nights })}: <span className="font-semibold">{t('priceVaries')}</span>
            </div>
            <div className="mt-1 text-xs text-gray-600">{t('contactForPricing')}</div>
          </div>
        );
      }

      return (
        <div className="mt-3">
          <div className="text-sm font-medium">
            {t('totalForNights', { nights })}: <span className="font-semibold">{total}€</span>
          </div>
        </div>
      );
    }

    const house = houseA;
    if (!house) return <div className="text-sm opacity-60">{t('priceNotAvailable')}</div>;
    const totalSingle = getTotalPriceForRangeLocal(house, sd, ed, guests);
    if (totalSingle === null) {
      return (
        <div className="mt-2 text-sm">
          <div className="font-medium">{t('priceForNights', { nights })}: <span className="font-semibold">{t('priceVaries')}</span></div>
          <div className="mt-1 text-xs text-gray-600">{t('contactForPricing')}</div>
        </div>
      );
    }

    return (
      <div className="mt-3">
        <div className="text-sm font-medium">{t('totalForNights', { nights })}: <span className="font-semibold">{totalSingle}€</span></div>
      </div>
    );
  }

  /* ---------------- Carousel rendering ---------------- */
  const renderCarouselForHouse = (house: HouseLight, mode: "arrival" | "departure") => {
    const houseId = house.id;
    const offset = getOffset(houseId, mode);
    const STEP = 7;

    const baseCandidate =
      mode === "departure"
        ? (startDate ? new Date(startDate) : new Date())
        : (startDate ? new Date(startDate) : new Date());

    const stripTimeLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = (a: Date, b: Date) => Math.round((stripTimeLocal(a).getTime() - stripTimeLocal(b).getTime()) / msPerDay);

    const today = stripTimeLocal(new Date());
    const globalMax = stripTimeLocal(getGlobalMaxDate());

    const minAllowed = today;
    const maxAllowed = globalMax;

    const minForMode = mode === "departure" && startDate ? stripTimeLocal(new Date(startDate)) : minAllowed;

    const maxStartBaseCandidate = stripTimeLocal(addDays(maxAllowed, -(DATE_WINDOW_DAYS - 1)));
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
      const sd = stripTimeLocal(d);
      return sd.getTime() >= stripTimeLocal(minForMode).getTime() && sd.getTime() <= stripTimeLocal(maxAllowed).getTime();
    });

    const occupiedSet = occupiedDatesByHouse[houseId] ?? new Set<string>();

    return (
      <div className="w-full">
        {/* Header con navegación */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-200">
          <button
            onClick={goPrev}
            disabled={!canPrev}
            className={`group flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${!canPrev
              ? "opacity-30 cursor-not-allowed text-gray-400"
              : "hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-primary)] border-2 border-[var(--color-primary)]"
              }`}
            aria-label="View previous dates"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">{t('previous')}</span>
          </button>

          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {mode === "arrival" ? t('checkInDatesFrom') : t('checkOutDatesFrom')}
            </span>
            <span className="text-sm font-bold text-gray-700 mt-1">{formatDateDDMMYYYY(finalBase)}</span>
          </div>

          <button
            onClick={goNext}
            disabled={!canNext}
            className={`group flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${!canNext
              ? "opacity-30 cursor-not-allowed text-gray-400"
              : "hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-primary)] border-2 border-[var(--color-primary)]"
              }`}
            aria-label="View next dates"
          >
            <span className="hidden sm:inline">{t('next')}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Grid de días */}
        <div className="hidden md:grid md:grid-cols-7 gap-3">
          {days.map((d) => {
            const ds = dateIso(d);
            const isOccupied = occupiedSet.has(ds);
            const isPrevOccupied = occupiedSet.has(dateIso(addDays(d, -1)));
            const isCheckinStart = isOccupied && !isPrevOccupied;
            const isCheckoutEnd = !isOccupied && isPrevOccupied;

            // Verificar si es nuestra fecha seleccionada
            const isOurCheckin = startDate && dateIso(startDate) === ds;
            const isOurCheckout = endDate && dateIso(endDate) === ds;

            // Verificar si el check-in seleccionado está disponible
            const checkinDateStr = startDate ? dateIso(startDate) : null;
            const isCheckinAvailable = checkinDateStr ? !occupiedSet.has(checkinDateStr) : false;

            // NUEVA VALIDACIÓN: Verificar si el checkout está disponible en modo departure
            let isCheckoutValidInDepartureMode = false;
            if (isOurCheckout && startDate) {
              const startDay = stripTimeLocal(new Date(startDate));
              const checkoutDay = stripTimeLocal(d);

              // El checkout debe estar después del checkin
              if (checkoutDay.getTime() > startDay.getTime()) {
                // Verificar que no haya días ocupados entre checkin y checkout (lógica de departure mode)
                let hasBlockingReservation = false;
                for (let checkDate = addDays(startDay, 1); stripTimeLocal(checkDate).getTime() < checkoutDay.getTime(); checkDate = addDays(checkDate, 1)) {
                  if (occupiedSet.has(dateIso(checkDate))) {
                    hasBlockingReservation = true;
                    break;
                  }
                }

                // Verificar que el día de checkout cumpla las reglas de departure
                const isOccupiedCheckout = occupiedSet.has(ds);
                const isPrevOccupiedCheckout = occupiedSet.has(dateIso(addDays(d, -1)));
                const isCheckinStartCheckout = isOccupiedCheckout && !isPrevOccupiedCheckout;
                const isCheckoutEndCheckout = !isOccupiedCheckout && isPrevOccupiedCheckout;

                // El checkout es válido si NO hay reservas bloqueantes Y el día cumple las reglas
                const checkoutDayIsValid = !((isOccupiedCheckout && !isCheckinStartCheckout) || isCheckoutEndCheckout);

                isCheckoutValidInDepartureMode = !hasBlockingReservation && checkoutDayIsValid;
              }
            }

            // --- NEW: si este día concreto puede usarse como check-in (y no es pasado) ---
            const isDayAvailableForCheckin = !occupiedSet.has(ds) && stripTimeLocal(d).getTime() >= today.getTime();

            let disabled = false;
            let visuallyDisabled = false; // nuevo: apariencia solo
            let availabilityStatus = "";
            let isBlockedByReservation = false;
            let isFirstAvailableCheckout = false;

            // Días pasados siempre deshabilitados
            if (stripTimeLocal(d).getTime() < today.getTime()) {
              disabled = true;
            }
            // Modo arrival: lógica especial para check-in
            else if (mode === "arrival") {
              // 1. Si es el día de check-out seleccionado Y es válido en departure mode
              if (isOurCheckout && isCheckoutValidInDepartureMode) {
                // mostrar como "disabled" visualmente pero permitir click (igual que en móvil)
                visuallyDisabled = true;
                availabilityStatus = "";
              }
              // 2. Si está ocupado
              else if (isOccupied) {
                disabled = true;
                availabilityStatus = "Not available";
              }
            }
            // Modo departure: lógica especial
            else if (mode === "departure") {
              if (startDate) {
                const startDay = stripTimeLocal(new Date(startDate));
                // No se puede seleccionar el mismo día de check-in o anterior
                if (stripTimeLocal(d).getTime() <= startDay.getTime()) {
                  disabled = true;
                }

                // Buscar la primera fecha ocupada después del check-in
                let firstOccupiedAfterCheckin: Date | null = null;
                const currentDay = addDays(startDay, 1);
                const maxCheck = addDays(startDay, 365); // Límite razonable

                for (let checkDate = new Date(currentDay); checkDate <= maxCheck; checkDate = addDays(checkDate, 1)) {
                  const isOccupiedCheck = occupiedSet.has(dateIso(checkDate));
                  const isPrevOccupiedCheck = occupiedSet.has(dateIso(addDays(checkDate, -1)));
                  const isCheckinStartCheck = isOccupiedCheck && !isPrevOccupiedCheck;

                  // Bloquea el checkout si está ocupado Y no es un 'checkin start' (que permite checkout)
                  // o si es el final de un checkout (que no permite checkout)
                  if ((isOccupiedCheck && !isCheckinStartCheck) || (!isOccupiedCheck && isPrevOccupiedCheck)) {
                    firstOccupiedAfterCheckin = new Date(checkDate);
                    break;
                  }
                }

                // Si hay una fecha ocupada después del check-in y el día actual está después de ella
                if (firstOccupiedAfterCheckin && stripTimeLocal(d).getTime() > stripTimeLocal(firstOccupiedAfterCheckin).getTime()) {
                  disabled = true;
                  isBlockedByReservation = true; // Marcar como bloqueado por reserva
                  availabilityStatus = "Not available";
                }
              }

              // Deshabilitar días ocupados (excepto si es inicio de check-in) o fin de checkout
              if ((isOccupied && !isCheckinStart) || isCheckoutEnd) {
                disabled = true;
                availabilityStatus = "Not available";
              }

              // CORRECCIÓN: Identificar el ÚLTIMO día disponible para checkout
              if (startDate && !disabled && stripTimeLocal(d).getTime() > stripTimeLocal(new Date(startDate)).getTime()) {
                let hasValidCheckout = false;

                if (endDate && stripTimeLocal(endDate).getTime() > stripTimeLocal(new Date(startDate)).getTime()) {
                  const startDay = stripTimeLocal(new Date(startDate));
                  const endDay = stripTimeLocal(endDate);

                  let hasReservationBetween = false;
                  for (let checkDate = addDays(startDay, 1); stripTimeLocal(checkDate).getTime() < endDay.getTime(); checkDate = addDays(checkDate, 1)) {
                    if (occupiedSet.has(dateIso(checkDate))) {
                      hasReservationBetween = true;
                      break;
                    }
                  }
                  hasValidCheckout = !hasReservationBetween;
                }

                if (!hasValidCheckout) {
                  const startDay = stripTimeLocal(new Date(startDate));
                  const maxCheck = addDays(startDay, 365);

                  // Buscar el primer día que no es seleccionable como Check-out
                  let firstBlockingDate: Date | null = null;
                  const currentDayForBlockingCheck = addDays(startDay, 1);

                  for (let checkDate = new Date(currentDayForBlockingCheck); checkDate <= maxCheck; checkDate = addDays(checkDate, 1)) {
                    const checkDateStr = dateIso(checkDate);
                    const isOccupiedCheck = occupiedSet.has(checkDateStr);
                    const isPrevOccupiedCheck = occupiedSet.has(dateIso(addDays(checkDate, -1)));
                    const isCheckinStartCheck = isOccupiedCheck && !isPrevOccupiedCheck;

                    // Si el día no es seleccionable: (Ocupado y no Check-in Start) O (No ocupado y Check-out End)
                    if ((isOccupiedCheck && !isCheckinStartCheck) || (!isOccupiedCheck && isPrevOccupiedCheck)) {
                      firstBlockingDate = new Date(checkDate);
                      break;
                    }
                  }

                  let lastAvailableCheckout: Date | null = null;

                  // El último disponible es el día anterior a la fecha de bloqueo
                  if (firstBlockingDate) {
                    lastAvailableCheckout = addDays(firstBlockingDate, -1);
                  }

                  if (lastAvailableCheckout && stripTimeLocal(lastAvailableCheckout).getTime() <= startDay.getTime()) {
                    lastAvailableCheckout = null;
                  }

                  if (lastAvailableCheckout && dateIso(d) === dateIso(lastAvailableCheckout)) {
                    isFirstAvailableCheckout = true;
                  }
                }
              }
            }

            // Si no está deshabilitado, está disponible
            if (!disabled && stripTimeLocal(d).getTime() >= today.getTime()) {
              availabilityStatus = "✓ Available";
            }

            // Determinar si este día debe mostrarse como seleccionado
            const isSelected =
              // Check-in en modo arrival (solo si no está ocupado Y NO ESTÁ DISABLED)
              (mode === "arrival" && isOurCheckin && !isOccupied && !disabled) ||
              // Check-out en modo arrival (solo si check-in es válido Y checkout es válido en departure mode)
              (mode === "arrival" && isOurCheckout && isCheckinAvailable && isCheckoutValidInDepartureMode) ||
              // Check-in en modo departure (solo si no está ocupado)
              (mode === "departure" && isOurCheckin && !isOccupied) ||
              // Check-out en modo departure (solo si es válido y no bloqueado/ocupado)
              (mode === "departure" && isOurCheckout && isCheckinAvailable && !isBlockedByReservation && !disabled);

            // El día de checkout en arrival, si es válido en departure mode, SÍ debe mostrarse como seleccionado
            const isSelectedAndAvailable =
              (mode === "arrival" && isOurCheckout && isCheckinAvailable && isCheckoutValidInDepartureMode) ||
              (isSelected && !isBlockedByReservation);

            // Solo dos colores: disponible o seleccionado (los disabled quedan en gris)
            let bgClass = "bg-white border-2 border-gray-200";
            let textClass = "text-gray-700";
            let statusClass = "text-gray-500";

            if (disabled && stripTimeLocal(d).getTime() < today.getTime()) {
              // Días pasados
              bgClass = "bg-gray-100 border-2 border-gray-200";
              textClass = "text-gray-400";
              statusClass = "text-gray-400";
            } else if (isSelectedAndAvailable) {
              // Días seleccionados y disponibles (color primary)
              bgClass = "bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]/40";
              textClass = "text-[var(--color-primary-dark)] font-bold";
              statusClass = "text-[var(--color-primary-dark)]";
            } else if ((disabled || visuallyDisabled) && stripTimeLocal(d).getTime() >= today.getTime()) {
              // Días no disponibles (gris) — visual disabled también cae aquí
              bgClass = "bg-gray-100 border-2 border-gray-300";
              textClass = "text-gray-500";
              statusClass = "text-gray-400";
            } else if (!disabled) {
              // Días disponibles (blanco)
              bgClass = "bg-white border-2 border-gray-200 hover:border-[var(--color-primary)] hover:shadow-lg";
            }

            // Manejo especial para el día de Check-out en modo arrival
            if (mode === "arrival" && isOurCheckout && isCheckinAvailable && isCheckoutValidInDepartureMode) {
              bgClass = "bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]/40";
              textClass = "text-[var(--color-primary-dark)] font-bold";
              statusClass = "text-[var(--color-primary-dark)]";
              // ADAPTACIÓN: no marcar disabled real, marcar solo visualmente
              visuallyDisabled = true;
            }

            // Determinar el label de selección - SOLO si está seleccionado y válido
            let selectionLabel = "";
            if (isOurCheckin && isCheckinAvailable) {
              selectionLabel = t('checkIn');
            } else if (isOurCheckout && isCheckinAvailable && isCheckoutValidInDepartureMode) {
              selectionLabel = t('checkOut');
            }

            return (
              <button
                key={ds}
                disabled={disabled}
                // accessibility: solo decir aria-disabled si está realmente no-clickable
                aria-disabled={disabled || (!isDayAvailableForCheckin && visuallyDisabled)}
                onClick={() => {
                  // si está real disabled, no hacer nada
                  if (disabled) return;

                  // Si en modo arrival seleccionamos el día de checkout actual,
                  // solo moveremos el checkout UNICAMENTE si ESE DÍA está disponible para check-in.
                  if (mode === "arrival" && endDate && dateIso(d) === dateIso(endDate)) {
                    const isDayAvailableForCheckin = !occupiedSet.has(dateIso(d));

                    if (isDayAvailableForCheckin) {
                      // comportamiento antiguo: dejar que handleSelectArrival procese y mueva el checkout si corresponde
                      handleSelectArrival(houseId, d);
                    } else {
                      // preservar el checkout en su sitio (no moverlo)
                      // llamamos a handleSelectArrival con la opción para preservar
                      handleSelectArrival(houseId, d, { preserveDepartureIfSame: true });
                    }
                  } else {
                    if (mode === "arrival") handleSelectArrival(houseId, d);
                    else handleSelectDeparture(houseId, d);
                  }
                }}
                className={`
    ${bgClass}
    ${textClass}
    p-4 rounded-xl relative transition-all duration-200
    flex flex-col items-center justify-between min-h-[140px]
    ${disabled
                    ? "cursor-not-allowed opacity-60"
                    : (
                      // si es visual disabled -> decidir si es clickable visualmente o no
                      visuallyDisabled
                        ? ((visuallyDisabled && isDayAvailableForCheckin)
                          ? "opacity-80 cursor-pointer hover:shadow-lg transform hover:scale-105"
                          : "opacity-60 cursor-not-allowed"
                        )
                        : "transform hover:scale-105 cursor-pointer"
                    )
                  }
    ${isFirstAvailableCheckout ? "animate-pulse-subtle" : ""}
  `}
              >

                {/* Label de Check-in/Check-out en la parte inferior */}
                {selectionLabel && (
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-[var(--color-primary)] text-white text-xs font-bold px-4 py-1 rounded-full shadow-md whitespace-nowrap z-10">
                    {selectionLabel}
                  </div>
                )}

                {/* Día de la semana */}
                <div className="text-xs font-bold uppercase tracking-wider opacity-75">
                  {d.toLocaleString(getLocaleString(locale), { weekday: "short" })}
                </div>

                {/* Día */}
                <div className="text-2xl font-bold my-2">{d.getDate()}</div>

                {/* Mes */}
                <div className="text-xs font-medium opacity-75 mb-2">
                  {d.toLocaleString(getLocaleString(locale), { month: "short" })}
                </div>

                {/* Precio */}
                <div className="mb-2">
                  <PriceBadgeLocal houseId={house.id} date={d} />
                </div>

                {/* Estado */}
                <div className={`text-xs font-bold ${statusClass} text-center leading-tight`}>
                  {availabilityStatus}
                </div>
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-4 justify-center text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white border-2 border-gray-200 rounded"></div>
              <span className="text-gray-600">{t('available')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]/40 rounded"></div>
              <span className="text-gray-600">{t('selected')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
              <span className="text-gray-600">{t('notAvailable')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };


  /* ---------------- Render ---------------- */
  return (
    <div className="max-w-6xl w-full mx-auto mt-28">
      <div className="relative md:min-w-[1000px] border border-[var(--color-primary)] rounded-2xl shadow-lg mt-6 sm:mt-16 p-6 md:p-8 flex flex-col items-center z-10 gap-4">
        {/* Imagen de fondo */}
        <div className="absolute inset-0 z-0 rounded-2xl overflow-hidden">
          <img
            src="/home/rubikiai_lago.avif"
            alt="Background"
            className="w-full h-full object-cover"
          />
          {/* Overlay de color secundario con mayor transparencia */}
          <div className="absolute inset-0 bg-[var(--color-secondary)]/90"></div>
        </div>

        {/* Contenido del formulario - relativo para estar encima del fondo */}
        <div className="relative z-10 w-full mb-4">
          <div className="sm:hidden flex justify-center">
            <label htmlFor="propertyTypeMobile" className="sr-only">Property type</label>
            <div className="relative w-40">
              <select
                id="propertyTypeMobile"
                value={propertyType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPropertyType(e.target.value as "todos" | "dupleksas" | "ezero namelis")}
                className="appearance-none w-full px-5 py-2 pr-10 rounded-full font-sans uppercase text-sm font-bold tracking-wide transition-colors border-2 border-[var(--color-primary)] bg-white text-[var(--color-secondary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-25"
              >
                <option value="todos">{t('all')}</option>
                <option value="dupleksas">{t('duplex')}</option>
                <option value="ezero namelis">{t('lakeHouse')}</option>
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
              className={`px-6 py-2 rounded-full font-sans uppercase text-sm font-bold tracking-wide transition-colors shadow-md ${propertyType === 'todos'
                ? 'bg-[var(--color-primary-dark)] text-white'
                : 'border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-white hover:bg-[var(--color-primary-dark)] hover:text-white'
                }`}
            >
              {t('all')}
            </button>
            <button
              onClick={() => setPropertyType('dupleksas')}
              className={`px-6 py-2 rounded-full font-sans uppercase text-sm font-bold tracking-wide transition-colors shadow-md ${propertyType === 'dupleksas'
                ? 'bg-[var(--color-primary-dark)] text-white'
                : 'border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-white hover:bg-[var(--color-primary-dark)] hover:text-white'
                }`}
            >
              {t('duplex')}
            </button>
            <button
              onClick={() => setPropertyType('ezero namelis')}
              className={`px-6 py-2 rounded-full font-sans uppercase text-sm font-bold tracking-wide transition-colors shadow-md ${propertyType === 'ezero namelis'
                ? 'bg-[var(--color-primary-dark)] text-white'
                : 'border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-white hover:bg-[var(--color-primary-dark)] hover:text-white'
                }`}
            >
              {t('lakeHouse')}
            </button>
          </div>
        </div>

        <div className="relative z-20 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full justify-center items-center">
          <div className="flex flex-col text-left flex-1 border-r border-[var(--color-primary)]/40 pr-4 w-full">
            <label className="text-[var(--color-primary)] text-sm mb-1 font-sans uppercase font-bold drop-shadow-sm">{t('checkIn')}</label>
            <DatePicker
              selected={startDate}
              onChange={onChangeArrival}
              minDate={new Date()}
              maxDate={getGlobalMaxDate()}
              open={openPicker === "arrival"}
              onInputClick={() => setOpenPicker("arrival")}
              onClickOutside={() => setOpenPicker(null)}
              popperClassName="z-[99999]"
              locale={locale}
              customInput={
                <div className="p-2 bg-transparent font-sans text-xl cursor-pointer text-white drop-shadow-md">
                  {startDate ? formatDateDDMMYYYY(startDate) : 'DD/MM/YYYY'}
                </div>
              }
            />
          </div>

          <div className="flex flex-col text-left flex-1 border-r border-[var(--color-primary)]/40 pr-4 w-full">
            <label className="text-[var(--color-primary)] text-sm mb-1 font-sans uppercase font-bold drop-shadow-sm">{t('checkOut')}</label>
            <DatePicker
              selected={endDate}
              onChange={onChangeDeparture}
              minDate={startDate ? new Date(startDate.getTime() + 86400000) : new Date()}
              maxDate={getGlobalMaxDate()}
              openToDate={startDate ?? new Date()}
              open={openPicker === "departure"}
              onInputClick={() => setOpenPicker("departure")}
              onClickOutside={() => setOpenPicker(null)}
              popperClassName="z-[99999]"
              locale={locale}
              customInput={
                <div className="p-2 bg-transparent font-sans text-xl cursor-pointer text-white drop-shadow-md">
                  {endDate ? formatDateDDMMYYYY(endDate) : 'DD/MM/YYYY'}
                </div>
              }
            />
          </div>

          <div className="flex flex-col text-left flex-1 w-full">
            <label className="text-[var(--color-primary)] text-sm mb-1 font-sans uppercase font-bold drop-shadow-sm">{t('guests')}</label>
            <div className="flex items-center justify-center p-2 bg-transparent text-white font-sans text-xl">
              <button onClick={() => handleGuestsChange(-1)} className="px-2 text-3xl leading-none hover:text-[var(--color-primary)] text-white transition-colors drop-shadow-md">-</button>
              <div className="w-12 text-center text-white drop-shadow-md">{guests}</div>
              <button onClick={() => handleGuestsChange(1)} className="px-2 text-3xl leading-none hover:text-[var(--color-primary)] text-white transition-colors drop-shadow-md">+</button>
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
          className="relative z-10 bg-[var(--color-primary-dark)] hover:bg-[var(--color-highlight)] text-white font-bold py-3 px-8 rounded-md transition-colors w-full md:w-auto mt-4 md:mt-0 font-sans shadow-md hover:shadow-lg"
        >
          {loading ? t('searching') : t('search')}
        </button>
      </div>

      <div className="mt-3 space-y-5">
        {showResults && houses.length === 0 && (
          <div className="text-center text-gray-600">{t('noResults')}</div>
        )}

        {houses.map((house) => {
          const img = getHouseImage(house.id);
          const isAvailable = isHouseAvailableNow(house);
          const isLoading = !!checkoutLoadingByHouse[house.id];
          const reserveButtonClass = isAvailable
            ? "bg-[var(--color-primary)] text-white hover:bg-opacity-90 transition duration-300"
            : "bg-gray-200 text-gray-500 cursor-not-allowed";
          const [idA, idB] = splitDuoId(house.id);
          const isDual = !!idB;

          return (
            <div key={house.id} className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl">
              <div className="flex flex-col md:flex-row">
                <div className="shrink-0 w-full md:w-80 lg:w-96">
                  {isDual ? (
                    // Mostrar dos imágenes lado a lado para búsquedas duales
                    <div className="w-full h-full grid grid-cols-2 gap-0">
                      <div className="w-full h-full overflow-hidden">
                        <img
                          key={getHouseImage(idA!).key}
                          src={getHouseImage(idA!).url}
                          alt={getHouseImage(idA!).alt}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
                        />
                      </div>
                      <div className="w-full h-full overflow-hidden">
                        <img
                          key={getHouseImage(idB).key}
                          src={getHouseImage(idB).url}
                          alt={getHouseImage(idB).alt}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
                        />
                      </div>
                    </div>
                  ) : (
                    // Mostrar una sola imagen para búsquedas normales
                    <div className="w-full aspect-[4/3] md:h-full overflow-hidden">
                      <img
                        key={img.key}
                        src={img.url}
                        alt={img.alt ?? house.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
                      />
                    </div>
                  )}
                </div>

                <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
                  <div>
                    <h3 className="text-3xl font-extrabold text-[var(--color-primary-dark)] leading-tight mb-2">
                      {house.name}
                    </h3>
                    <p className="text-base font-medium text-gray-500 mb-4">
                      {t('pricingForGuests', { guests: guests })}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {startDate ? (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 space-y-3">
                        {startDate && endDate && (
                          <div className="mb-2">
                            <div className="flex items-center gap-2 mb-1">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                {t('selectedDates')}
                              </span>
                            </div>
                            <div className="text-sm text-gray-700 font-medium">
                              {formatDateDDMMYYYY(startDate)} → {formatDateDDMMYYYY(endDate)}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-500 font-semibold text-base">€</span>
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('reservationFee')}</span>
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
                                <span className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wide">{t('totalStay')}</span>
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
                        <span className="text-sm text-gray-500">{t('selectDatesSeePrices')}</span>
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
                            {t('processing')}
                          </span>
                        ) : isAvailable ? (
                          t('select')
                        ) : (
                          t('notAvailable')
                        )}
                      </button>

                      <button
                        onClick={() => toggleOpenHouse(house.id)}
                        className="w-full sm:flex-1 py-3.5 px-6 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-300 text-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {(isMobile ? (mobileCalendarHouseId === house.id ? t('close') : t('viewCalendar')) : (openHouseId === house.id ? t('close') : t('viewCalendar')))}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {openHouseId === house.id && (
                <div className="p-6 md:p-8 bg-gradient-to-br from-gray-50 to-white border-t-4 border-[var(--color-primary)]">
                  <div className="max-w-5xl mx-auto">

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
                          <div className="leading-tight">{t('checkIn')}</div>
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
                          <div className="leading-tight">{t('checkOut')}</div>
                          {endDate && (
                            <div className="text-[10px] sm:text-xs font-normal mt-0.5 sm:mt-1 opacity-90 whitespace-nowrap">
                              {formatDateDDMMYYYY(endDate)}
                            </div>
                          )}
                        </div>
                      </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-100">
                      {renderCarouselForHouse(house, calendarModeByHouse[house.id] || "arrival")}
                    </div>

                    <div className="mt-4 text-center text-sm text-gray-600 bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <svg className="w-5 h-5 inline-block mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('calendarTip')}
                    </div>
                  </div>
                </div>
              )}
              {mobileCalendarHouseId === house.id && isMobile && (
                <MobileCalendarMonthModal house={house} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

}