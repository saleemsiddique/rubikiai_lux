export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

const EXTRA_GUEST_PRICE = 40; // € per extra person per night
const JACUZZI_BASE_PRICE = 65; // € cubre hasta 2 personas
const JACUZZI_EXTRA_PRICE = 10; // € por cada huésped extra >=3

/* ---------------- Date & helpers (LOCAL, no UTC) ---------------- */
function toDateOnly(v: any) {
  if (!v) return null;
  let d: Date;
  try {
    if (typeof v?.toDate === "function") d = v.toDate();
    else if (typeof v === "string") {
      // soporta "YYYY-MM-DD" además de ISO y Date parseable
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y, m, day] = v.split("-").map(Number);
        d = new Date(y, (m || 1) - 1, day || 1);
      } else {
        d = new Date(v);
      }
    } else {
      d = new Date(v);
    }
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0); // 00:00 local
    return d;
  } catch {
    return null;
  }
}

/** YYYY-MM-DD en hora local (no usar toISOString()) */
function dateIsoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  r.setHours(0, 0, 0, 0);
  return r;
}

// weekdayKey para precios base semanales
function weekdayKey(date: Date) {
  const map = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;
  return map[date.getDay()];
}

/* ---------- specialPrices normalizer ----------
   En Firestore ahora guardaremos algo así:
   {
     pricePerNight: { monday: 120, ... },
     specialPrices: {
        singleDays: { "2025-01-10": 200, "2025-01-11": 210 },
        ranges: [
          { start: "2025-02-01", end: "2025-02-05", price: 180 }, // inclusive
          { start: "2025-03-15", end: "2025-03-20", price: 230 }
        ]
     }
   }

   Para no romper frontend viejo, algunas casas antiguas pueden seguir teniendo:
   specialPrices: { "2025-01-10": 200, "2025-01-11": 210 }

   Queremos una función que dado ese objeto devuelva:
   - getOverride(isoDate: "YYYY-MM-DD") -> number | null
*/
type LegacySpecialMap = Record<string, number>;
type RangeEntry = { start: string; end: string; price: number };
type UnifiedSpecialPrices = {
  singleDays: Record<string, number>;
  ranges: RangeEntry[];
};

function normalizeSpecialPrices(raw: any): UnifiedSpecialPrices {
  // Caso 1: legacy "specialPrices" = { "2025-01-10": 200, ... }
  if (
    raw &&
    !raw.singleDays &&
    !raw.ranges &&
    typeof raw === "object" &&
    !Array.isArray(raw)
  ) {
    const singleDays: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as LegacySpecialMap)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === "number") {
        singleDays[k] = v;
      }
    }
    return { singleDays, ranges: [] };
  }

  // Caso 2: new format
  const singleDays: Record<string, number> =
    raw && typeof raw.singleDays === "object" && raw.singleDays
      ? raw.singleDays
      : {};

  const ranges: RangeEntry[] = Array.isArray(raw?.ranges)
    ? raw.ranges
      .filter(
        (r: any) =>
          r &&
          typeof r.start === "string" &&
          typeof r.end === "string" &&
          typeof r.price === "number"
      )
      .map((r: any) => ({
        start: r.start,
        end: r.end,
        price: r.price,
      }))
    : [];

  return { singleDays, ranges };
}

function isIsoDateStr(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isoInRange(iso: string, startIso: string, endIso: string) {
  // rango inclusivo [startIso, endIso]
  // comparación lexicográfica es correcta porque usamos YYYY-MM-DD
  return startIso <= iso && iso <= endIso;
}

/** getSpecialOverride:
 * Devuelve el precio especial si está definido para ese día (primero singleDay, luego rango).
 */
function getSpecialOverride(
  specials: UnifiedSpecialPrices,
  iso: string
): number | null {
  // día exacto
  if (typeof specials.singleDays[iso] === "number") {
    return specials.singleDays[iso];
  }
  // mirar rangos
  for (const r of specials.ranges) {
    if (
      isIsoDateStr(r.start) &&
      isIsoDateStr(r.end) &&
      typeof r.price === "number" &&
      isoInRange(iso, r.start, r.end)
    ) {
      return r.price;
    }
  }
  return null;
}

/** Precio para una fecha:
 * PRIORIDAD specialPrices (día exacto o dentro de rango)
 * → fallback pricePerNight[weekday]
 */
function getPriceForDate(
  house: any,
  specials: UnifiedSpecialPrices,
  d: Date
): number | null {
  if (!house) return null;

  const iso = dateIsoLocal(d);
  const override = getSpecialOverride(specials, iso);
  if (typeof override === "number") return override;

  const key = weekdayKey(d);
  const val = house?.pricePerNight?.[key];
  return typeof val === "number" ? val : null;
}

/* ---------------- Reservations (ocupación) ---------------- */
function shouldIncludeReservation(res: any, nowMs = Date.now()) {
  const status = String(res?.status ?? "").toLowerCase();

  // expiresAt puede ser Timestamp, Date o string
  let expiresAt: Date | null = null;
  try {
    if (res?.expiresAt) {
      expiresAt =
        typeof res.expiresAt?.toDate === "function"
          ? res.expiresAt.toDate()
          : new Date(res.expiresAt);
      if (Number.isNaN(expiresAt!.getTime())) expiresAt = null;
    }
  } catch {
    expiresAt = null;
  }

  return (
    status === "admin" ||
    status === "reserved" ||
    (status === "pending" && !!expiresAt && expiresAt.getTime() > nowMs)
  );
}

/** Trae reservas relevantes para un id (houseId==id y houseIds array-contains id), sin duplicados */
async function fetchReservationsForHouse(id: string) {
  const map = new Map<string, any>();

  // 1) houseId == id
  const snap1 = await adminDb
    .collection("reservations")
    .where("houseId", "==", id)
    .get();
  snap1.docs.forEach((d) => map.set(d.id, d.data()));

  // 2) houseIds array-contains id
  const snap2 = await adminDb
    .collection("reservations")
    .where("houseIds", "array-contains", id)
    .get();
  snap2.docs.forEach((d) => map.set(d.id, d.data()));

  return Array.from(map.values());
}

/* ---------------- Houses ---------------- */
async function fetchHouseDoc(id: string) {
  const docSnap = await adminDb.collection("houses").doc(id).get();
  if (!docSnap.exists) return null;
  const data = docSnap.data() || {};

  // normalizamos estructuras
  const pricePerNight =
    typeof data.pricePerNight === "object" && data.pricePerNight
      ? data.pricePerNight
      : {};

  // puede ser legacy map o { singleDays, ranges }
  const specialsUnified = normalizeSpecialPrices(
    data.specialPrices ?? {}
  );

  return {
    id: docSnap.id,
    alias: data.alias || "",
    name: data.name || "",
    type: data.type ?? null,
    maxGuests: typeof data.maxGuests === "number" ? data.maxGuests : null,
    includedGuests:
      typeof data.includedGuests === "number"
        ? data.includedGuests
        : 2, // default: 2 por unidad
    pricePerNight,
    specialsUnified,
    images: Array.isArray(data.images) ? data.images : [],
  };
}

/* ---------------- Route ---------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      houseId,
      houseParam,
      startDate,
      endDate,
      guests = 2,
      jacuzzi = false,
      jacuzziDays: rawJacuzziDays = 0, // <-- nuevo campo aceptado
    } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate required" },
        { status: 400 }
      );
    }

    const start = toDateOnly(startDate);
    const end = toDateOnly(endDate);
    if (!start || !end || !(start < end)) {
      return NextResponse.json(
        { error: "invalid date range" },
        { status: 400 }
      );
    }

    // ---- Resolve ids
    let ids: string[] = [];
    if (houseId) {
      ids = String(houseId)
        .split("__")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (houseParam) {
      const snap = await adminDb
        .collection("houses")
        .where("alias", "==", String(houseParam))
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json(
          { error: "house not found" },
          { status: 404 }
        );
      }
      ids = [snap.docs[0].id];
    } else {
      return NextResponse.json(
        { error: "houseId or houseParam required" },
        { status: 400 }
      );
    }

    ids = Array.from(new Set(ids));
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "no house ids" },
        { status: 400 }
      );
    }

    // ---- Fetch houses (+ unify specials)
    const housesData: Array<{
      id: string;
      includedGuests: number;
      pricePerNight: any;
      specialsUnified: UnifiedSpecialPrices;
    }> = [];

    for (const id of ids) {
      const h = await fetchHouseDoc(id);
      if (!h)
        return NextResponse.json(
          { error: `house ${id} not found` },
          { status: 404 }
        );
      housesData.push({
        id: h.id,
        includedGuests: h.includedGuests,
        pricePerNight: h.pricePerNight,
        specialsUnified: h.specialsUnified,
      });
    }

    // ---- Ocupación (bloqueos/reservas existentes)
    const occupiedUnion = new Set<string>();
    for (const id of ids) {
      const reservations = await fetchReservationsForHouse(id);
      const nowMs = Date.now();
      for (const r of reservations) {
        if (!shouldIncludeReservation(r, nowMs)) continue;
        const ci = toDateOnly(r.checkIn);
        const co = toDateOnly(r.checkOut);
        if (!ci || !co) continue;
        let cur = new Date(ci);
        while (cur < co) {
          occupiedUnion.add(dateIsoLocal(cur));
          cur = addDays(cur, 1);
        }
      }
    }

    let cur = new Date(start);
    while (cur < end) {
      if (occupiedUnion.has(dateIsoLocal(cur))) {
        return NextResponse.json(
          { error: "Selected dates are unavailable" },
          { status: 409 }
        );
      }
      cur = addDays(cur, 1);
    }

    // ---- Cálculo de extras (huéspedes)
    const guestsNum = Math.max(0, Number(guests) || 0);

    // huéspedes incluidos sumando todas las unidades (2 por unidad si no hay includedGuests específico)
    const includedBase = housesData.reduce((acc, h) => {
      return acc + (typeof h.includedGuests === "number"
        ? h.includedGuests
        : 2);
    }, 0);

    const extraGuests = Math.max(0, guestsNum - includedBase);
    const perNightSurcharge = extraGuests * EXTRA_GUEST_PRICE;

    // ---- Jacuzzi: cargo en función de jacuzziDays (cargo plano por la estancia, no por noche)
    // Normalizamos jacuzziDays y lo limitamos a [0, nights]
    const nights = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    let jacuzziDays = Number(rawJacuzziDays || 0);
    if (!Number.isFinite(jacuzziDays) || jacuzziDays < 0) jacuzziDays = 0;
    jacuzziDays = Math.floor(jacuzziDays);
    // si jacuzzi está activado, forzamos al menos 1 día como mínimo si jacuzziDays era 0 en el request?
    // Aquí respetamos lo enviado: si jacuzzi === true pero jacuzziDays === 0 lo limitamos a 1
    if (jacuzzi && jacuzziDays === 0) jacuzziDays = 1;
    // cap al número de noches
    jacuzziDays = Math.min(jacuzziDays, nights);

    let jacuzziFee = 0;
    if (jacuzzi && jacuzziDays > 0) {
      // El frontend espera que el extra por jacuzzi se base en guests - 2 (no en includedBase)
      const jacuzziExtraGuests = Math.max(0, guestsNum - 2);

      // primer día
      const firstDayFee = JACUZZI_BASE_PRICE + jacuzziExtraGuests * JACUZZI_EXTRA_PRICE;

      // días adicionales
      const additionalDays = Math.max(0, jacuzziDays - 1);
      const additionalDaysFee = additionalDays * (45 + jacuzziExtraGuests * JACUZZI_EXTRA_PRICE);

      jacuzziFee = firstDayFee + additionalDaysFee;
    } else {
      jacuzziFee = 0;
    }

    // ---- Total por noches
    let totalNightsOnly = 0;
    const perNightBreakdown: Array<{
      date: string;
      perUnit: Array<{ id: string; price: number | null }>;
      nightTotal: number;
    }> = [];

    cur = new Date(start);
    while (cur < end) {
      let nightSum: number | null = 0;
      const perUnit: Array<{ id: string; price: number | null }> = [];

      for (const h of housesData) {
        const p = getPriceForDate(h, h.specialsUnified, cur);
        perUnit.push({ id: h.id, price: p });

        if (p === null) {
          nightSum = null;
          break;
        }
        nightSum += p;
      }

      if (nightSum === null) {
        return NextResponse.json({
          total: null,
          first: null,
          nights,
          extraGuests,
          includedBase,
          jacuzziFee,
          variable: true,
          perNightBreakdown,
          debug: {
            reason:
              "missing price for some night (base or special or range)",
          },
        });
      }

      nightSum += perNightSurcharge;
      totalNightsOnly += nightSum;

      perNightBreakdown.push({
        date: dateIsoLocal(cur),
        perUnit,
        nightTotal: nightSum,
      });

      cur = addDays(cur, 1);
    }

    // ---- First night (sin jacuzzi; noches+extraGuests)
    let firstNight = 0;
    const firstDay = new Date(start);
    for (const h of housesData) {
      const baseP =
        getPriceForDate(h, h.specialsUnified, firstDay) ?? 0;
      firstNight += baseP;
    }
    firstNight += perNightSurcharge;

    // ---- Totales finales
    const extrasTotal = jacuzzi ? jacuzziFee : 0;
    const grandTotal = totalNightsOnly + extrasTotal;

    return NextResponse.json({
      total: totalNightsOnly, // alojamiento + extraGuests (todas las noches, sin jacuzzi)
      first: firstNight, // coste primera noche (sin jacuzzi)
      nights,
      extraGuests,
      includedBase,
      jacuzziFee, // cargo jacuzzi (único para la estancia, calculado por jacuzziDays)
      jacuzziDays, // añadido para transparencia (opcional)
      extrasTotal, // actualmente solo jacuzzi
      grandTotal, // total final con jacuzzi
      variable: false,
      perNightBreakdown,
    });
  } catch (err) {
    console.error("[/api/reservations/price] error:", err);
    return NextResponse.json(
      { error: "internal error" },
      { status: 500 }
    );
  }
}
