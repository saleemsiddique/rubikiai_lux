export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/* ---------------- Date helpers (LOCAL) ---------------- */
function dateIsoLocalFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toDateOnly(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ---------------- Specials & Seasons normalization (reused logic) ---------------- */
type RangeEntry = { start: string; end: string; price: number };
type UnifiedSpecialPrices = { singleDays: Record<string, number>; ranges: RangeEntry[] };
type SeasonEntry = { id: string; name?: string; start: string; end: string; weekdayPrices?: Record<string, number> };

function isIsoDateStr(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function normalizeSpecialPrices(raw: any): UnifiedSpecialPrices {
  if (
    raw &&
    !raw.singleDays &&
    !raw.ranges &&
    typeof raw === "object" &&
    !Array.isArray(raw)
  ) {
    // legacy map -> singleDays
    const singleDays: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, any>)) {
      if (isIsoDateStr(k) && typeof v === "number") singleDays[k] = v;
    }
    return { singleDays, ranges: [] };
  }

  const singleDays: Record<string, number> =
    raw && typeof raw.singleDays === "object" && raw.singleDays ? raw.singleDays : {};

  const ranges: RangeEntry[] = Array.isArray(raw?.ranges)
    ? raw.ranges
        .filter(
          (r: any) =>
            r &&
            typeof r.start === "string" &&
            typeof r.end === "string" &&
            typeof r.price === "number" &&
            isIsoDateStr(r.start) &&
            isIsoDateStr(r.end)
        )
        .map((r: any) => ({ start: r.start, end: r.end, price: r.price }))
    : [];

  return { singleDays, ranges };
}

function normalizeSeasons(rawSeasons: any): SeasonEntry[] {
  if (!rawSeasons || typeof rawSeasons !== "object") return [];
  const out: SeasonEntry[] = [];
  for (const [k, v] of Object.entries(rawSeasons)) {
    if (!v || typeof v !== "object") continue;
    const id = String((v as any).id || k);
    const name = (v as any).name ? String((v as any).name) : id;
    const start = typeof (v as any).start === "string" ? (v as any).start : null;
    const end = typeof (v as any).end === "string" ? (v as any).end : null;
    const wp =
      (v as any).weekdayPrices && typeof (v as any).weekdayPrices === "object"
        ? (v as any).weekdayPrices
        : undefined;
    // require both start & end (per tus reglas)
    if (!start || !end) continue;
    if (!isIsoDateStr(start) || !isIsoDateStr(end)) continue;
    out.push({ id, name, start, end, weekdayPrices: wp });
  }
  return out;
}
function isoInRange(iso: string, startIso: string, endIso: string) {
  return startIso <= iso && iso <= endIso;
}

/* weekday key */
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

/** Decide price for a single date with priority:
 * 1) special singleDays / ranges
 * 2) season.weekdayPrices (first season matching date)
 * 3) house.pricePerNight[weekday]
 *
 * returns { price: number|null, source: 'special'|'season'|'fallback'|null, seasonId?:string|null }
 */
function priceForDateWithSeasons(
  housePricePerNight: any,
  specials: UnifiedSpecialPrices,
  seasons: SeasonEntry[] | undefined,
  d: Date
) {
  const iso = dateIsoLocalFromDate(d);

  // 1) special singleDays
  if (specials && typeof specials.singleDays === "object" && typeof specials.singleDays[iso] === "number") {
    return { price: specials.singleDays[iso], source: "special" as const, seasonId: null };
  }
  // 1b) ranges
  if (specials && Array.isArray(specials.ranges)) {
    for (const r of specials.ranges) {
      if (isIsoDateStr(r.start) && isIsoDateStr(r.end) && isoInRange(iso, r.start, r.end)) {
        return { price: r.price, source: "special" as const, seasonId: null };
      }
    }
  }

  // 2) season
  if (Array.isArray(seasons)) {
    for (const s of seasons) {
      if (isIsoDateStr(s.start) && isIsoDateStr(s.end) && isoInRange(iso, s.start, s.end)) {
        const key = weekdayKey(d);
        if (s.weekdayPrices && typeof s.weekdayPrices[key] === "number") {
          return { price: s.weekdayPrices[key], source: "season" as const, seasonId: s.id };
        }
        // if season matches but no weekday price defined, we continue to fallback
        break; // prefer first matching season
      }
    }
  }

  // 3) fallback weekly base
  if (housePricePerNight && typeof housePricePerNight === "object") {
    const key = weekdayKey(d);
    const v = housePricePerNight[key];
    if (typeof v === "number") return { price: v, source: "fallback" as const, seasonId: null };
  }

  return { price: null, source: null as any, seasonId: null };
}

/* ---------------- Availability route ---------------- */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate: startISO, endDate: endISO, guests, propertyType } = body;

    const reqStart = toDateOnly(startISO);
    const reqEnd = toDateOnly(endISO);
    if (!reqStart || !reqEnd) {
      return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
    }
    if (!(reqStart < reqEnd)) {
      return NextResponse.json({ error: "start must be before end" }, { status: 400 });
    }

    // query houses
    let housesQuery: FirebaseFirestore.Query = adminDb.collection("houses");
    if (propertyType && propertyType !== "todos") {
      housesQuery = housesQuery.where("type", "==", propertyType) as any;
    }
    const housesSnap = await housesQuery.get();

    const houses = housesSnap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        maxGuests: typeof data.maxGuests === "number" ? data.maxGuests : null,
        images: Array.isArray(data.images) ? data.images : [],
        name: data.name || "",
        type: data.type || null,
        description: data.description || "",
        pricePerNight: typeof data.pricePerNight === "object" && data.pricePerNight ? data.pricePerNight : {},
        rawSpecialPrices: data.specialPrices ?? {},
        rawSeasons: data.seasons ?? {},
      };
    });

    const reservationsRef = adminDb.collection("reservations");
    const OCCUPIED_STATUSES = new Set(["reserved", "admin", "complete"]);

    const resultsPromises = houses.map(async (house) => {
      // fetch reservations for this house (houseId + array-contains)
      const q1 = reservationsRef.where("houseId", "==", house.id).get();
      const q2 = reservationsRef.where("houseIds", "array-contains", house.id).get();
      const [snap1, snap2] = await Promise.all([q1, q2]);

      const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      snap1.forEach((d) => docsById.set(d.id, d));
      snap2.forEach((d) => docsById.set(d.id, d));

      // occupiedDates map
      const occupiedDates: Record<string, boolean> = {};
      let hasOverlap = false;

      docsById.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const status = (data.status || "").toString().toLowerCase();
        // consider only statuses that block
        if (!OCCUPIED_STATUSES.has(status)) return;

        const resStart = toDateOnly(data.checkIn);
        const resEnd = toDateOnly(data.checkOut);
        if (!resStart || !resEnd) return;

        // mark days [resStart, resEnd)
        let cur = new Date(resStart);
        while (cur < resEnd) {
          occupiedDates[dateIsoLocalFromDate(cur)] = true;
          cur = addDaysLocal(cur, 1);
        }

        // overlap check between [resStart, resEnd) and [reqStart, reqEnd)
        if (resStart < reqEnd && resEnd > reqStart) {
          hasOverlap = true;
        }
      });

      // capacity
      const isCapacityOk = (house.maxGuests ?? 0) >= (guests ?? 0);
      const isAvailable = !hasOverlap;

      // normalize specials & seasons
      const specialsUnified = normalizeSpecialPrices(house.rawSpecialPrices);
      const seasons = normalizeSeasons(house.rawSeasons);

      // compute price preview for the requested range (single-unit house)
      let cur = new Date(reqStart);
      let nights = 0;
      let total = 0;
      let variable = false;
      let first: number | null = null;
      while (cur < reqEnd) {
        const res = priceForDateWithSeasons(house.pricePerNight, specialsUnified, seasons, cur);
        if (res.price === null) {
          variable = true;
          break;
        }
        if (nights === 0) first = res.price;
        total += res.price;
        nights++;
        cur = addDaysLocal(cur, 1);
      }

      const pricePreview = {
        first: first === undefined ? null : first,
        total: variable ? null : total,
        nights,
        variable,
      };

      return {
        id: house.id,
        name: house.name,
        type: house.type,
        description: house.description,
        images: house.images,
        maxGuests: house.maxGuests,
        pricePerNight: house.pricePerNight,
        seasons, // normalized array (so frontend can show them)
        specialsUnified, // normalized specials
        occupiedDates,
        isAvailable,
        isCapacityOk,
        pricePreview,
      };
    });

    const results = await Promise.all(resultsPromises);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("Availability API error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/* Small helper for local addDays (keeps 00:00) */
function addDaysLocal(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  r.setHours(0, 0, 0, 0);
  return r;
}
