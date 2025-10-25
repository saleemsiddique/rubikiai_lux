// app/api/reservations/price/route.ts
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
    else d = new Date(v);
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

/** Precio para una fecha: PRIORIDAD specialPrices[ISO-local] -> fallback pricePerNight[weekday] */
function getPriceForDate(house: any, d: Date): number | null {
  if (!house) return null;

  // override puntual
  const iso = dateIsoLocal(d);
  const sp = house?.specialPrices?.[iso];
  if (typeof sp === "number") return sp;

  // base semanal
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

  // Normaliza estructura esperada por el pricing
  const pricePerNight =
    typeof data.pricePerNight === "object" && data.pricePerNight ? data.pricePerNight : {};
  const specialPrices =
    typeof data.specialPrices === "object" && data.specialPrices ? data.specialPrices : {};

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
    specialPrices,
    images: Array.isArray(data.images) ? data.images : [],
  };
}

/* ---------------- Route ---------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { houseId, houseParam, startDate, endDate, guests = 2, jacuzzi = false } = body;


    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }

    const start = toDateOnly(startDate);
    const end = toDateOnly(endDate);
    if (!start || !end || !(start < end)) {
      return NextResponse.json({ error: "invalid date range" }, { status: 400 });
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
        return NextResponse.json({ error: "house not found" }, { status: 404 });
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
      return NextResponse.json({ error: "no house ids" }, { status: 400 });
    }

    // ---- Fetch houses
    const housesData: any[] = [];
    for (const id of ids) {
      const h = await fetchHouseDoc(id);
      if (!h) return NextResponse.json({ error: `house ${id} not found` }, { status: 404 });
      housesData.push(h);
    }

    // ---- Ocupación: unión de todas las unidades implicadas
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

    // ---- Selección de unidades a tarificar
    // Regla: si el cliente envía houseId combinado ("a__b"), SIEMPRE sumamos esas unidades.
    // Si es single, solo esa.
    const pricingHouses = housesData.slice();

    // ---- Cálculo de extras
    const guestsNum = Math.max(0, Number(guests) || 0);
    // huéspedes incluidos por defecto sumando todas las unidades (2 por unidad si no hay includedGuests específico)
    const includedBase = pricingHouses.reduce((acc, h) => {
      return acc + (typeof h.includedGuests === "number" ? h.includedGuests : 2);
    }, 0);
    const extraGuests = Math.max(0, guestsNum - includedBase);
    // recargo por persona extra POR NOCHE
    const perNightSurcharge = extraGuests * EXTRA_GUEST_PRICE;
    // ---- Jacuzzi: cargo único por estancia ----
    // Regla de negocio actual:
    // 65€ incluye hasta 2 personas, +10€ por cada huésped extra
    let jacuzziFee = 0;
    if (jacuzzi) {
      const jacuzziExtraGuests = Math.max(0, guestsNum - 2);
      jacuzziFee = JACUZZI_BASE_PRICE + jacuzziExtraGuests * JACUZZI_EXTRA_PRICE;
    }


    // ---- Total por noches
    const nights = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

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

      for (const h of pricingHouses) {
        const p = getPriceForDate(h, cur);
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
          debug: { reason: "missing price for some night (base or special)" },
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

    // ---- First night (solo noches+extras por persona, sin jacuzzi)
    let firstNight = 0;
    const firstDay = new Date(start);
    for (const h of pricingHouses) {
      firstNight += getPriceForDate(h, firstDay) ?? 0;
    }
    firstNight += perNightSurcharge;

    // ---- Totales finales
    const extrasTotal = jacuzzi ? jacuzziFee : 0;
    const grandTotal = totalNightsOnly + extrasTotal;

    return NextResponse.json({
      total: totalNightsOnly,   // total de alojamiento + personas extra (sin jacuzzi)
      first: firstNight,        // coste de la primera noche (sin jacuzzi)
      nights,
      extraGuests,
      includedBase,
      jacuzziFee,               // suplemento jacuzzi calculado (pago único)
      extrasTotal,              // lo que se suma aparte (ahora mismo sólo jacuzzi)
      grandTotal,               // total final incluyendo jacuzzi
      variable: false,
      perNightBreakdown,
    });
  } catch (err) {
    console.error("[/api/reservations/price] error:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
