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
    d.setHours(0, 0, 0, 0);
    return d;
  } catch {
    return null;
  }
}

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

/* ---------------- Season & Price Logic ---------------- */
type Season = {
  name: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  weekdayPrices: Record<string, number>;
  specialPrices?: Record<string, number>;
};

/**
 * Encuentra la season activa para una fecha dada.
 * Retorna null si no hay season aplicable.
 */
function findSeasonForDate(seasons: Season[], iso: string): Season | null {
  if (!Array.isArray(seasons)) return null;
  
  for (const season of seasons) {
    if (!season.start || !season.end) continue;
    // comparación lexicográfica es correcta para YYYY-MM-DD
    if (season.start <= iso && iso <= season.end) {
      return season;
    }
  }
  return null;
}

/**
 * Obtiene el precio para una fecha específica con la siguiente prioridad:
 * 1. specialPrices global (día exacto)
 * 2. specialPrices dentro de la season activa (si existe)
 * 3. weekdayPrices de la season activa (si existe)
 * 4. pricePerNight global (fallback)
 */
function getPriceForDate(house: any, d: Date): number | null {
  if (!house) return null;

  const iso = dateIsoLocal(d);
  
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
  const weekday = weekdayKey(d);
  const val = house.pricePerNight[weekday];
  return typeof val === "number" ? val : null;
}

/* ---------------- Reservations (ocupación) ---------------- */
function shouldIncludeReservation(res: any, nowMs = Date.now()) {
  const status = String(res?.status ?? "").toLowerCase();

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

async function fetchReservationsForHouse(id: string) {
  const map = new Map<string, any>();

  const snap1 = await adminDb
    .collection("reservations")
    .where("houseId", "==", id)
    .get();
  snap1.docs.forEach((d) => map.set(d.id, d.data()));

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

  const pricePerNight =
    typeof data.pricePerNight === "object" && data.pricePerNight
      ? data.pricePerNight
      : {};

  const specialPrices =
    typeof data.specialPrices === "object" && data.specialPrices
      ? data.specialPrices
      : {};

  const seasons = Array.isArray(data.seasons) ? data.seasons : [];

  return {
    id: docSnap.id,
    alias: data.alias || "",
    name: data.name || "",
    type: data.type ?? null,
    maxGuests: typeof data.maxGuests === "number" ? data.maxGuests : null,
    includedGuests:
      typeof data.includedGuests === "number"
        ? data.includedGuests
        : 2,
    pricePerNight,
    specialPrices,
    seasons,
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
      jacuzziDays: rawJacuzziDays = 0,
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

    // ---- Fetch houses
    const housesData: Array<{
      id: string;
      includedGuests: number;
      pricePerNight: any;
      specialPrices: any;
      seasons: Season[];
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
        specialPrices: h.specialPrices,
        seasons: h.seasons,
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

    const includedBase = housesData.reduce((acc, h) => {
      return acc + (typeof h.includedGuests === "number"
        ? h.includedGuests
        : 2);
    }, 0);

    const extraGuests = Math.max(0, guestsNum - includedBase);
    const perNightSurcharge = extraGuests * EXTRA_GUEST_PRICE;

    // ---- Jacuzzi
    const nights = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    let jacuzziDays = Number(rawJacuzziDays || 0);
    if (!Number.isFinite(jacuzziDays) || jacuzziDays < 0) jacuzziDays = 0;
    jacuzziDays = Math.floor(jacuzziDays);
    if (jacuzzi && jacuzziDays === 0) jacuzziDays = 1;
    jacuzziDays = Math.min(jacuzziDays, nights);

    let jacuzziFee = 0;
    if (jacuzzi && jacuzziDays > 0) {
      const jacuzziExtraGuests = Math.max(0, guestsNum - 2);
      const firstDayFee = JACUZZI_BASE_PRICE + jacuzziExtraGuests * JACUZZI_EXTRA_PRICE;
      const additionalDays = Math.max(0, jacuzziDays - 1);
      const additionalDaysFee = additionalDays * (45 + jacuzziExtraGuests * JACUZZI_EXTRA_PRICE);
      jacuzziFee = firstDayFee + additionalDaysFee;
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
          debug: {
            reason: "missing price for some night",
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

    // ---- Reservation fee
    let firstNight = 0;
    const firstDay = new Date(start);
    for (const h of housesData) {
      const baseP = getPriceForDate(h, firstDay) ?? 0;
      firstNight += baseP;
    }
    firstNight += perNightSurcharge;

    // ---- Totales finales
    const extrasTotal = jacuzzi ? jacuzziFee : 0;
    const grandTotal = totalNightsOnly + extrasTotal;

    return NextResponse.json({
      total: totalNightsOnly,
      first: firstNight,
      nights,
      extraGuests,
      includedBase,
      jacuzziFee,
      jacuzziDays,
      extrasTotal,
      grandTotal,
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