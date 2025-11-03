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
setDefaultLocale('es'); // todas las instancias empiezan en lunes

/**
 * Nota: mappings de rutas / slugs y la lógica de cálculo seguro de precio
 * deben estar centralizados. Has dicho que ya creaste:
 *  - lib/houseRoutes.ts
 *  - app/api/reservations/price/route.ts
 *
 * No re-definimos esos aquí.
 */

/* ---------------- Types ---------------- */
interface HouseLight {
  id: string;
  name?: string;
  maxGuests?: number;
  images?: string[];
  type?: string;
  occupiedDates?: Record<string, boolean>;
  description?: string;
  specialPrices?: Record<string, number>;
}

/* Props */
interface ReservationFormProps {
  onReserve?: (houseId: string, startDate: Date, endDate: Date, guests: number) => void;
  showResults?: boolean;
}

/* ---------------- Config / constants (local) ---------------- */
const DATE_WINDOW_DAYS = 14;
const MAX_AHEAD_DAYS = 365; // <-- nuevo: límite máximo hacia adelante (1 año)
const getGlobalMaxDate = () => addDays(new Date(), MAX_AHEAD_DAYS);
export const EXTRA_GUEST_PRICE = 40; // € per extra person per night
const MAX_GUESTS_GLOBAL = 8;

/* ---------------- Helpers ---------------- */
/** Safe: id may be undefined */
function isDuoId(id?: string) {
  return !!id && id.includes("__");
}

/** Safe split, accepts undefined; returns tuple [idA?, idB?] */
function splitDuoId(id?: string): (string | undefined)[] {
  if (!id) return [undefined, undefined];
  if (!isDuoId(id)) return [id, undefined];
  const [a, b] = id.split("__");
  return [a || undefined, b || undefined];
}

/** Return Date at 00:00 or null if value can't be parsed */
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

/** Convert Date -> YYYY-MM-DD */
// Reemplaza la función actual:
function dateIso(d: Date) {
  // NO usar toISOString() (UTC) porque desplaza día según timezone
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`; // YYYY-MM-DD en LOCAL
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

/** Check range overlaps occupied set (occupiedSet contains ISO 'YYYY-MM-DD') */
function rangeOverlapsOccupied(start: Date, end: Date, occupiedSet: Set<string>) {
  if (!start || !end) return false;
  let cur = new Date(start);
  while (cur < end) {
    if (occupiedSet.has(dateIso(cur))) return true;
    cur = addDays(cur, 1);
  }
  return false;
}

/* weekday key helper */
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

/* Price lookup helper (prioriza specialPrices -> fallback pricePerNight[weekday]) */
function getPriceForDate(house: any, d: Date): number | null {
  if (!house) return null;

  // 1) override puntual por ISO (YYYY-MM-DD)
  const iso = dateIso(d);
  const sp = house?.specialPrices?.[iso];
  if (typeof sp === "number") return sp;

  // 2) base semanal
  if (!house.pricePerNight) return null;
  const key = weekdayKey(d);
  const val = house.pricePerNight[key];
  return typeof val === "number" ? val : null;
}


/* ---------------- Firestore helpers ---------------- */
async function fetchReservations(houseId: string) {
  const reservationsRef = collection(db, "reservations");

  // 1) q1: reservas con campo houseId === houseId (incluye documentos que guardaron el id combinado "a__b")
  const q1 = query(reservationsRef, where("houseId", "==", houseId));
  const snap1 = await getDocs(q1);

  // 2) q2: reservas cuyo array houseIds contiene el id (incluye reservas duales que listan componentes)
  const q2 = query(reservationsRef, where("houseIds", "array-contains", houseId));
  const snap2 = await getDocs(q2);

  // combinar resultados (por id de documento) para evitar duplicados
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
  // Solo cuentan las que bloquean de verdad
  return status === "admin" || status === "reserved" || status === "complete";
}


type HouseImage = { key: string; url: string; alt?: string };

// Mapea IDs de casa a clave+url de imagen
const HOUSE_IMAGES: Record<string | number, HouseImage> = {
  "L0TeFf2LmrWGAaAyS8NY": { key: "L0TeFf2LmrWGAaAyS8NY", url: "./ezero-namelis/lake-house1.png", alt: "Alojamiento 1" },
  "PZwbfMYlSXj61uYYJutg": { key: "PZwbfMYlSXj61uYYJutg", url: "/dupleksas/1-dupleksas-n1.jpeg", alt: "Alojamiento 2" },
  "oDzv9346CdaAsok162sX": { key: "oDzv9346CdaAsok162sX", url: "/dupleksas/2-dupleksas-n1.jpeg", alt: "Alojamiento 3" },
};

// Devuelve la imagen para un houseId o un placeholder
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

  // occupiedDatesByHouse: houseId -> Set<ISO date>
  const [occupiedDatesByHouse, setOccupiedDatesByHouse] = useState<Record<string, Set<string>>>({});
  const [carouselOffsetByHouse, setCarouselOffsetByHouse] = useState<Record<string, { arrival: number; departure: number }>>({});

  // debajo de los useState de houses / lastApiResults
  const resultsIndex: Record<string, HouseLight> = React.useMemo(() => {
    const idx: Record<string, HouseLight> = {};
    // prioriza los últimos resultados (los que se renderizan)
    for (const h of houses) idx[h.id] = h;
    // completa con el snapshot de la última búsqueda
    for (const h of lastApiResults) if (!idx[h.id]) idx[h.id] = h;
    return idx;
  }, [houses, lastApiResults]);

  // ✅ SIEMPRE llama a useHouse, incluso si id es undefined, para cumplir Rules of Hooks
  function useHouseMerged(id?: string) {
    const ctx = useHouse(id as any); // llamada incondicional

    if (!id) return null;            // early-return permitido (después del hook)

    const fromResults = resultsIndex[id];

    // estados intermedios coherentes
    if (ctx === undefined && !fromResults) return undefined as any; // "loading"
    if (ctx === null && !fromResults) return null;                  // "no existe"

    // fusión de datos (prioriza contexto, rellena con resultados)
    const merged: any = { ...(fromResults || {}), ...(ctx || {}) };
    if (!merged.specialPrices && fromResults?.specialPrices) {
      merged.specialPrices = fromResults.specialPrices;
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

  /* Quick helpers (mobile) para saltar ventanas completas de 14 días */
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

  // Read query params once to pre-populate
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
      // trigger search asynchronously (same tick)
      setTimeout(() => searchHouses(sDate, eDate, g ? parseInt(g, 10) : undefined, t ? t : undefined), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /* Datepicker range handler */
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

      // Si estamos en la home ('/'): solo actualizar el número y salir,
      // sin buscar ni regenerar nada.
      if (pathname === "/") {
        return next;
      }

      // --- TU LÓGICA ORIGINAL SE MANTIENE PARA OTRAS RUTAS ---
      if (startDate && endDate) {
        if (lastApiResults && lastApiResults.length > 0) {
          // regenerar localmente (rápido, sin depender de la API)
          void regenerateResultsForGuests(next, startDate, endDate, propertyType);
        } else {
          // si no hay lastApiResults (primera búsqueda) -> llamar a la API
          void searchHouses(startDate, endDate, next, propertyType);
        }
      } else {
        // Sin fechas: filtrar localmente la lista actual por capacidad
        setHouses((prevHouses) => prevHouses.filter((h) => (h.maxGuests ?? 0) >= next));
        // y recalcular flags de disponibilidad localmente
        setTimeout(() => {
          recomputeHousesAvailability(startDate, endDate, undefined, undefined, next);
        }, 0);
      }

      return next;
    });
  };


  // helper para indicar loading por houseId
  const setCheckoutLoading = (houseId: string, v: boolean) =>
    setCheckoutLoadingByHouse((p) => ({ ...p, [houseId]: v }));

  /**
   * Ahora NO llamamos Stripe. Simplemente navegamos a la página intermedia
   * /checkout-details con todos los datos como query.
   *
   * Esa página pedirá los datos del huésped, jacuzzi, etc,
   * y desde allí sí se creará la sesión de checkout.
   */
  const createCheckoutAndRedirect = (
    houseIdOrSlug: string,
    s: Date,
    e: Date,
    guestsNum: number,
    houseSlug?: string
  ) => {
    // Marcamos loading sólo visualmente en el botón de esa house
    setCheckoutLoading(houseIdOrSlug, true);

    const q = new URLSearchParams({
      houseId: houseIdOrSlug,
      houseSlug: houseSlug ?? "",
      start: s.toISOString(),
      end: e.toISOString(),
      guests: String(guestsNum),
    });

    router.push(`/checkout-details?${q.toString()}`);

    // importante: paramos el spinner localmente una vez navegamos
    // (Next.js va a montar otra página inmediatamente)
    setCheckoutLoading(houseIdOrSlug, false);
  };



  /** Handler unificado para Reserve now (desktop + mobile) */
  const handleReserveClick = async (house: HouseLight) => {
    if (!isHouseAvailableNow(house)) return;

    const slug = slugify(house.name);
    // si no hay fechas, comportarse como antes (ir a la página de la casa)
    if (!startDate || !endDate) {
      router.push(house.type === "dupleksas" ? `/dupleksas/${slug}` : `/${slug}`);
      return;
    }

    // Si es duo (id con "__") y hay más de 4 guests -> crear sesión de checkout
    if (isDuoId(house.id) && guests > 4) {
      await createCheckoutAndRedirect(house.id, startDate, endDate, guests, slug);
      return;
    }

    // comportamiento anterior: onReserve callback o push con query
    const q = `start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}&guests=${encodeURIComponent(String(guests))}&type=${encodeURIComponent(house.type ?? '')}&house=${encodeURIComponent(slug)}`;
    if (onReserve) {
      onReserve(house.id, startDate, endDate, guests);
      return;
    }
    router.push(`${house.type === "dupleksas" ? `/dupleksas/${slug}` : `/${slug}`}?${q}`);
  };


  /* ---------------- Search / availability (calls backend) ---------------- */
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

      // keep results, possibly generate duo combos locally for UX
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

      // filter by capacity
      results = results.filter((h) => (h.maxGuests ?? 0) >= effectiveGuests);

      // set preliminary results so UI doesn't flicker too much
      setHouses(results);

      // --- PREFETCH OCCUPIED DATES AND USE THEM IMMEDIATELY ---
      // fetchOccupiedDatesForHouse devuelve un Set<string>
      const occupiedSetsArray = await Promise.all(results.map((h) => fetchOccupiedDatesForHouse(h.id)));
      const occupiedMap: Record<string, Set<string>> = {};
      results.forEach((h, idx) => {
        occupiedMap[h.id] = occupiedSetsArray[idx] ?? new Set<string>();
      });

      // Merge into state (so futuras operaciones lo tengan)
      setOccupiedDatesByHouse((prev) => ({ ...prev, ...occupiedMap }));

      // Recompute availability usando el mapa recién obtenido (override)
      recomputeHousesAvailability(sDate, eDate, results, { ...occupiedDatesByHouse, ...occupiedMap });
    } catch (err) {
      console.error("searchHouses error:", err);
      setHouses([]);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Occupied dates (per house) ---------------- */
  const fetchOccupiedDatesForHouse = async (houseId?: string, force = false): Promise<Set<string>> => {
    if (!houseId) return new Set<string>();
    if (occupiedDatesByHouse[houseId] && !force) return occupiedDatesByHouse[houseId];

    try {
      // 1) IDs “componentes” si es dúo, o el propio si es single
      const idsToQuery = isDuoId(houseId) ? houseId.split("__").filter(Boolean) : [houseId];

      // 2) Traer reservas relevantes (tu helper actual ya sirve)
      const reservations: any[] = [];
      for (const id of idsToQuery) {
        if (!id) continue;
        const part = await fetchReservations(id); // usa q1 (houseId==id) + q2 (houseIds array-contains id)
        reservations.push(...part);
      }

      // 3) Construir un mapa id->Set<YYYY-MM-DD>, propagando días a todos los IDs vinculados
      const perId: Record<string, Set<string>> = {};
      const addForId = (id: string, iso: string) => {
        if (!perId[id]) perId[id] = new Set<string>();
        perId[id].add(iso);
      };

      const nowMs = Date.now();

      for (const res of reservations) {
        if (!shouldIncludeReservation(res)) continue;

        const checkIn = toDateOnly(res.checkIn);
        const checkOut = toDateOnly(res.checkOut);
        if (!checkIn || !checkOut) continue;

        // IDs implicados por esta reserva:
        // - los individuales en houseIds[]
        // - y, si el doc es dúo, el id combinado (res.houseId) para que el combo también quede bloqueado
        const involvedIds = new Set<string>();
        if (Array.isArray(res.houseIds)) {
          res.houseIds.filter(Boolean).forEach((id: string) => involvedIds.add(id));
        }
        if (typeof res.houseId === "string" && res.houseId.includes("__")) {
          involvedIds.add(res.houseId); // el combinado
        }

        // Marcar todos los días (checkout exclusivo)
        let cur = new Date(checkIn);
        while (cur < checkOut) {
          const iso = dateIso(cur);
          for (const id of involvedIds) addForId(id, iso);
          cur = addDays(cur, 1);
        }
      }

      // 4) Un “union” para el ID solicitado (por si venía combinado y/o single)
      const unionForRequested = new Set<string>();
      // lo que ya tuviéramos en memoria para ese id
      if (occupiedDatesByHouse[houseId]) {
        occupiedDatesByHouse[houseId].forEach((d) => unionForRequested.add(d));
      }
      // si es dúo, unimos los componentes
      if (isDuoId(houseId)) {
        for (const id of houseId.split("__").filter(Boolean)) {
          perId[id]?.forEach((d) => unionForRequested.add(d));
        }
      }
      // y el propio (por si perId ya tiene entradas para el combinado)
      perId[houseId]?.forEach((d) => unionForRequested.add(d));

      // 5) Guardar TODO en estado: cada id implicado + el solicitado
      setOccupiedDatesByHouse((prev) => {
        const next = { ...prev };
        // merge helper
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


  /**
 * Regenera _localmente_ los resultados a partir del último apiResults
 * - genera combos duplex (pares)
 * - filtra por capacidad
 * - prefetch de occupiedDates para esos resultados
 * - actualiza houses y occupiedDatesByHouse y recomputa disponibilidad
 */
  const regenerateResultsForGuests = async (guestsCount: number, sDate?: Date | null, eDate?: Date | null, type?: string) => {
    const effectiveType = type ?? propertyType;
    const apiResults = lastApiResults ?? [];

    // generar combos (igual que searchHouses)
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

    // filtrar por capacidad
    results = results.filter((h) => (h.maxGuests ?? 0) >= guestsCount);

    // actualizar resultados (preliminar)
    setHouses(results);

    // PREFETCH occupied dates para estos resultados
    try {
      const occupiedSetsArray = await Promise.all(results.map((h) => fetchOccupiedDatesForHouse(h.id)));
      const occupiedMap: Record<string, Set<string>> = {};
      results.forEach((h, idx) => {
        occupiedMap[h.id] = occupiedSetsArray[idx] ?? new Set<string>();
      });

      // merge to state
      setOccupiedDatesByHouse((prev) => ({ ...prev, ...occupiedMap }));

      // recompute availability using the newly fetched occupied map
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

  /* Carousel helpers */
  const getOffset = (houseId: string, mode: "arrival" | "departure") => {
    const o = carouselOffsetByHouse[houseId];
    return o ? (o[mode] ?? 0) : 0;
  };

  /* Availability computation */
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

  /* Small helpers comparing ISO strings */
  const isBefore = (aIso: string, bIso: string) => new Date(aIso) < new Date(bIso);
  const isAfter = (aIso: string, bIso: string) => new Date(aIso) > new Date(bIso);

  /* Select handlers used in the calendar */
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
    if (isOccupied(houseId, iso)) return;
    if (startDate) {
      const startIso = dateIso(startDate);
      if (!isAfter(iso, startIso)) return;
    }
    setEndDate(d);
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
    if (!house.pricePerNight) return null;
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

      const firstNightBase = (getPriceForDate(houseA, sd) ?? 0) + (getPriceForDate(houseB, sd) ?? 0);
      const firstNight = firstNightBase + perNightSurcharge;

      return (
        <div className="mt-3">
          <div className="text-sm font-medium">
            Total for {nights} night{nights > 1 ? "s" : ""}: <span className="font-semibold">{total}€</span>
          </div>
        </div>
      );
    }

    // single
    const house = houseA;
    if (!house || !house.pricePerNight) return <div className="text-sm opacity-60">Price not available</div>;
    const totalSingle = getTotalPriceForRangeLocal(house, sd, ed, guests);
    if (totalSingle === null) {
      return (
        <div className="mt-2 text-sm">
          <div className="font-medium">Price for {nights} night{nights > 1 ? "s" : ""}: <span className="font-semibold">Price varies</span></div>
          <div className="mt-1 text-xs text-gray-600">Contact us for exact pricing or check the price for each night above.</div>
        </div>
      );
    }
    const extraGuestsSingle = Math.max(0, guests - 2);
    const perNightSurchargeSingle = extraGuestsSingle * EXTRA_GUEST_PRICE;
    const firstNightBaseSingle = getPriceForDate(house, sd) ?? 0;
    const firstNightSingle = firstNightBaseSingle + perNightSurchargeSingle;

    return (
      <div className="mt-3">
        <div className="text-sm font-medium">Total for {nights} night{nights > 1 ? "s" : ""}: <span className="font-semibold">{totalSingle}€</span></div>
      </div>
    );
  }


  /* ---------------- Carousel rendering (trimmed) ---------------- */
  const renderCarouselForHouse = (house: HouseLight, mode: "arrival" | "departure") => {
    const houseId = house.id;
    const offset = getOffset(houseId, mode);
    const STEP = 7;

    // base para el carrusel según modo
    const baseCandidate =
      mode === "departure" && endDate ? new Date(endDate) : (startDate ? new Date(startDate) : new Date());

    // helpers locales
    const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = (a: Date, b: Date) => Math.round((stripTime(a).getTime() - stripTime(b).getTime()) / msPerDay);

    const today = stripTime(new Date());
    const globalMax = stripTime(getGlobalMaxDate());

    // límites globales de ventana [hoy, hoy+1año]
    const minAllowed = today;
    const maxAllowed = globalMax;

    // en departure no mostrar antes de la llegada (si existe)
    const minForMode = mode === "departure" && startDate ? stripTime(new Date(startDate)) : minAllowed;

    // rango válido para el primer día de la ventana
    const maxStartBaseCandidate = stripTime(addDays(maxAllowed, -(DATE_WINDOW_DAYS - 1)));
    const maxStartBase = maxStartBaseCandidate < minForMode ? minForMode : maxStartBaseCandidate;
    const minStartBase = minForMode;

    // offsets permitidos
    const allowedOffsetMin = diffDays(minStartBase, baseCandidate);
    const allowedOffsetMax = diffDays(maxStartBase, baseCandidate);

    // clamp del offset
    const effectiveOffset = Math.min(Math.max(offset, allowedOffsetMin), allowedOffsetMax);

    // navegación
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

    // base final + días de la ventana
    const base = addDays(baseCandidate, effectiveOffset);
    const finalBase = new Date(base);

    let days: Date[] = Array.from({ length: DATE_WINDOW_DAYS }).map((_, i) => addDays(finalBase, i));
    days = days.filter((d) => {
      const sd = stripTime(d);
      return sd.getTime() >= stripTime(minForMode).getTime() && sd.getTime() <= stripTime(maxAllowed).getTime();
    });

    const occupiedSet = occupiedDatesByHouse[houseId] ?? new Set<string>();

    return (
      <div className="w-full mt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-2 items-center text-sm text-gray-700">
            <button
              onClick={goPrev}
              disabled={!canPrev}
              className={`px-2 py-1 border rounded ${!canPrev ? "opacity-40 cursor-not-allowed" : "hover:bg-neutral-100"}`}
              aria-label="Anterior"
            >
              ◀
            </button>
            <div className="font-medium">{mode === "arrival" ? "Select arrival" : "Select departure"}</div>
          </div>
          <div>
            <button
              onClick={goNext}
              disabled={!canNext}
              className={`px-2 py-1 border rounded ${!canNext ? "opacity-40 cursor-not-allowed" : "hover:bg-neutral-100"}`}
              aria-label="Siguiente"
            >
              ▶
            </button>
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <div className="inline-flex gap-3 py-2">
            {days.map((d) => {
              const ds = dateIso(d);
              const isOccupied = occupiedSet.has(ds);
              const isPrevOccupied = occupiedSet.has(dateIso(addDays(d, -1)));
              const isCheckinStart = isOccupied && !isPrevOccupied; // ya lo tienes
              const isCheckoutEnd = !isOccupied && isPrevOccupied;  // 👈 NUEVO: fin de ocupación (checkout)

              // reglas de deshabilitado
              let disabled = false;

              // 1) pasadas
              if (stripTime(d).getTime() < today.getTime()) disabled = true;

              // 2) arrival: bloquear si el día está ocupado (check-in no posible ese día)
              //    (un día de checkout NO suele estar en occupiedSet; por eso se permite)
              if (mode === "arrival" && isOccupied) disabled = true;

              if (mode === "departure") {
                if (startDate) {
                  const startDay = stripTime(new Date(startDate));
                  if (stripTime(d).getTime() <= startDay.getTime()) disabled = true;
                }
                // bloquear si es un día ocupado "real" (no inicio de ocupación)
                if (isOccupied && !isCheckinStart) disabled = true;

                // NO bloquear si es el día de checkout (isCheckoutEnd)
                // (no añadas nada aquí: al ser false, queda clicable)
              }


              const selectedArrival = startDate && dateIso(startDate) === ds;
              const selectedDeparture = endDate && dateIso(endDate) === ds;
              const inRange = startDate && endDate && dateIso(startDate) <= ds && ds <= dateIso(endDate);

              const paintAsOccupied =
                (mode === "arrival" && isOccupied) ||
                (mode === "departure" && ((isOccupied && !isCheckinStart) || isCheckoutEnd)); // 👈 incluye checkout

              const classes = [
                "min-w-[96px] p-3 rounded-lg text-center border transition-transform transform hover:scale-105 flex flex-col items-center justify-between",
              ];

              if (paintAsOccupied) {
                classes.push("bg-red-600 text-white");
                if (disabled) classes.push("cursor-not-allowed"); // solo si realmente está bloqueado
              } else if (selectedArrival || selectedDeparture) {
                classes.push("bg-[var(--color-primary)] text-white");
              } else if (inRange) {
                classes.push("bg-[var(--color-primary)]/10");
              } else {
                classes.push("bg-white text-[var(--color-text)]");
              }

              if (disabled && !paintAsOccupied) classes.push("opacity-60 cursor-not-allowed");



              return (
                <button
                  key={ds}
                  className={classes.join(" ")}
                  onClick={() => {
                    if (disabled) return;
                    if (mode === "arrival") handleSelectArrival(houseId, d);
                    else handleSelectDeparture(houseId, d);
                  }}
                >
                  <div className="text-sm font-semibold">{formatDateDDMMYYYY(d)}</div>
                  <div className="text-xs text-gray-500">{d.toLocaleString(undefined, { weekday: "short" })}</div>
                  <div className="mt-2"><PriceBadgeLocal houseId={house.id} date={d} /></div>
                  <div className="text-xs mt-2">
                    {mode === "arrival" && isOccupied ? "Booked" : mode === "arrival" ? "Arrive" : "Depart"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };



  /* ---------------- Render ---------------- */
  return (
    <div className="max-w-6xl w-full mx-auto">
      {/* Header area: compact search controls */}
      <div className="card-soft mt-6 sm:mt-16 p-6 md:p-8 flex flex-col items-center relative z-10">
        {/* Property Type Toggle */}
        {/* - En móvil: mostramos un select (sm:hidden)
   - En pantallas >= sm: mostramos los botones (hidden sm:flex) */}
        <div className="mb-4 z-10 relative w-full">
          {/* Mobile: select (estético, consistente con los botones) */}
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

              {/* Chevron SVG (posicionado a la derecha, no interfiere con clicks) */}
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


          {/* Desktop / Tablet: buttons */}
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
              maxDate={getGlobalMaxDate()}                // límite: hoy + 1 año
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
              maxDate={getGlobalMaxDate()}                // límite: hoy + 1 año
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

          {/* Guests */}
          <div className="flex flex-col text-left flex-1 w-full">
            <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Guests</label>
            <div className="flex items-center justify-center p-2 bg-transparent text-[var(--color-text)] font-sans text-xl">
              <button onClick={() => handleGuestsChange(-1)} className="px-2 text-3xl leading-none text-[var(--color-text)] hover:text-[var(--color-primary-dark)]">-</button>
              <div className="w-12 text-center">{guests}</div>
              <button onClick={() => handleGuestsChange(1)} className="px-2 text-3xl leading-none text-[var(--color-text)] hover:text-[var(--color-primary-dark)]">+</button>
            </div>
          </div>
        </div>

        {/* Reserve Button */}
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

      {/* Results list */}
      <div className=" mt-3 space-y-5">
        {showResults && houses.length === 0 && (
          <div className="text-center text-gray-600">No results. Select dates and click &quot;Check availability&quot;.</div>
        )}

        {houses.map((house) => {
          const img = getHouseImage(house.id);

          // Determine button state for cleaner logic
          const isAvailable = isHouseAvailableNow(house);
          const isLoading = !!checkoutLoadingByHouse[house.id];
          const reserveButtonClass = isAvailable
            ? "bg-[var(--color-primary)] text-white hover:bg-opacity-90 transition duration-300"
            : "bg-gray-200 text-gray-500 cursor-not-allowed";

          return (
            // Tarjeta con esquinas sutilmente redondeadas y un borde limpio
            <div key={house.id} className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl">

              <div className="flex flex-col md:flex-row">

                {/* Sección de Imagen (Mucho más grande en desktop) */}
                <div className="shrink-0 w-full md:w-80 lg:w-96">
                  <div className="w-full aspect-[4/3] md:h-full overflow-hidden">
                    <img
                      key={img.key}
                      src={img.url}
                      alt={img.alt ?? house.name}
                      loading="lazy"
                      // Efecto visual más impactante
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
                    />
                  </div>
                </div>

                {/* Contenido Principal y Acciones */}
                <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">

                  {/* Detalles de la Casa */}
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

                  {/* Área de Precios y Botones con diseño moderno */}
                  <div className="space-y-4">

                    {/* Card de Precios con diseño premium */}
                    {startDate ? (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 space-y-3">
                        {/* Precio por noche */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Precio por primera noche</span>
                          </div>
                          <PriceBadgeLocal houseId={house.id} date={startDate} />
                        </div>

                        {/* Precio Total - Solo si hay rango completo */}
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

                    {/* Botones de Acción con diseño mejorado */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Botón de Reserva Principal */}
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

                      {/* Botón Secundario para Ver Calendario */}
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

              {/* Sección de Disponibilidad (Expandida) */}
              {openHouseId === house.id && (
                <div className="p-6 md:p-8 bg-gray-50 border-t border-gray-200">
                  <div className="text-xl font-bold text-gray-800 mb-4">Calendario de Disponibilidad</div>

                  <div className="space-y-6">
                    {/* Carousels para la selección de fechas */}
                    <div className="p-4 bg-white rounded-lg shadow-md">
                      <span className="text-sm font-semibold text-gray-600 block mb-2">Fecha de Llegada</span>
                      {renderCarouselForHouse(house, "arrival")}
                    </div>

                    <div className="p-4 bg-white rounded-lg shadow-md">
                      <span className="text-sm font-semibold text-gray-600 block mb-2">Fecha de Salida</span>
                      {renderCarouselForHouse(house, "departure")}
                    </div>

                    {/* Hint para móviles/info */}
                    <div className="mt-3 text-xs text-gray-500">
                      El calendario muestra las próximas fechas disponibles en bloques de {DATE_WINDOW_DAYS} días.
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
