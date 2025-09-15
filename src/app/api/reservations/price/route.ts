import { NextResponse } from "next/server";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firestore";

const EXTRA_GUEST_PRICE = 40; // € per extra person per night

function toDateOnly(v: any) {
  if (!v) return null;
  const d = typeof v?.toDate === "function" ? v.toDate() : new Date(v);
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
function weekdayKey(date: Date) {
  const map = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return map[date.getDay()];
}
function getPriceForDate(house: any, d: Date): number | null {
  if (!house || !house.pricePerNight) return null;
  const key = weekdayKey(d);
  const val = house.pricePerNight[key];
  return typeof val === "number" ? val : null;
}

async function fetchReservationsForHouse(houseId: string) {
  const reservationsRef = collection(db, "reservations");
  const q = query(reservationsRef, where("houseId", "==", houseId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

function getOccupiedSetFromReservations(reservations: any[]) {
  const s = new Set<string>();
  reservations.forEach((r) => {
    const ci = toDateOnly(r.checkIn);
    const co = toDateOnly(r.checkOut);
    if (!ci || !co) return;
    let cur = new Date(ci);
    while (cur < co) {
      s.add(dateIso(cur));
      cur = addDays(cur, 1);
    }
  });
  return s;
}

async function fetchHouseDoc(id: string) {
  const hRef = doc(db, "houses", id);
  const hSnap = await getDoc(hRef);
  if (!hSnap.exists()) return null;
  return { id: hSnap.id, ...(hSnap.data() || {}) };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { houseId, houseParam, startDate, endDate, guests = 2 } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }

    const start = new Date(startDate); start.setHours(0,0,0,0);
    const end = new Date(endDate); end.setHours(0,0,0,0);
    if (!(start < end)) {
      return NextResponse.json({ error: "invalid date range" }, { status: 400 });
    }

    // Resolve ids
    let ids: string[] = [];
    if (houseId) {
      ids = houseId.split("__").map((s: string) => s.trim()).filter(Boolean);
    } else if (houseParam) {
      const housesRef = collection(db, "houses");
      const q = query(housesRef, where("alias", "==", houseParam));
      const snap = await getDocs(q);
      if (snap.empty) return NextResponse.json({ error: "house not found" }, { status: 404 });
      ids = [snap.docs[0].id];
    } else {
      return NextResponse.json({ error: "houseId or houseParam required" }, { status: 400 });
    }

    // dedupe
    ids = Array.from(new Set(ids));
    if (ids.length === 0) return NextResponse.json({ error: "no house ids" }, { status: 400 });

    // fetch docs
    const housesData: any[] = [];
    for (const id of ids) {
      const h = await fetchHouseDoc(id);
      if (!h) return NextResponse.json({ error: `house ${id} not found` }, { status: 404 });
      housesData.push(h);
    }

    // Build occupied union (we keep availability check across all provided ids so any occupied half blocks the dates)
    const occupiedUnion = new Set<string>();
    for (const id of ids) {
      const reservations = await fetchReservationsForHouse(id);
      const s = getOccupiedSetFromReservations(reservations);
      s.forEach((d) => occupiedUnion.add(d));
    }

    // check availability
    let cur = new Date(start);
    while (cur < end) {
      if (occupiedUnion.has(dateIso(cur))) {
        return NextResponse.json({ error: "Selected dates are unavailable" }, { status: 409 });
      }
      cur = addDays(cur, 1);
    }

    // ----- IMPORTANT: choose which house documents to USE FOR PRICING
    // Goal: if the caller passed multiple ids (e.g. duplex-1__duplex-2) but specifically
    // requested the first id and that single doc can accommodate all guests, price only that doc.
    // Only when a single doc can't accommodate the requested guest count we will sum multiple docs.

    const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const guestsNum = Math.max(0, Number(guests) || 0);

    // Default: use all fetched docs for pricing
    let pricingHouses = housesData.slice();

    if (ids.length > 0) {
      const firstId = ids[0];
      const firstDoc = housesData.find((h) => h.id === firstId);
      if (firstDoc) {
        const includedFirst = typeof firstDoc.includedGuests === "number"
          ? firstDoc.includedGuests
          : (typeof firstDoc.maxGuests === "number" ? firstDoc.maxGuests : 2);
        const maxFirst = typeof firstDoc.maxGuests === "number" ? firstDoc.maxGuests : Math.max(includedFirst, includedFirst + 2);
        // If the first document alone can host guestsNum, use only it for pricing
        if (guestsNum <= maxFirst) {
          pricingHouses = [firstDoc];
        }
      }
    }

    // INCLUDED BASE: use pricingHouses to compute includedGuests (and fallbacks)
    const includedBase = pricingHouses.reduce((acc, h) => {
      if (typeof h.includedGuests === "number") return acc + h.includedGuests;
      if (typeof h.maxGuests === "number") return acc + h.maxGuests; // use maxGuests as included when doc defines it
      return acc + 2;
    }, 0);

    const extraGuests = Math.max(0, guestsNum - includedBase);
    const perNightSurcharge = extraGuests * EXTRA_GUEST_PRICE;

    // Detailed breakdown for debugging (optional)
    const perNightBreakdown: { date: string; perUnit: Array<{ id: string; price: number | null }>; nightTotal: number | null }[] = [];

    // price calc: SUM only over pricingHouses (not all fetched docs)
    let total = 0;
    cur = new Date(start);
    while (cur < end) {
      let nightTotal: number | null = 0;
      const perUnit: Array<{ id: string; price: number | null }> = [];
      for (const h of pricingHouses) {
        const p = getPriceForDate(h, cur);
        perUnit.push({ id: h.id, price: p });
        if (p === null) {
          nightTotal = null;
          break;
        }
        nightTotal += p;
      }
      if (nightTotal === null) {
        return NextResponse.json({ total: null, first: null, nights, variable: true, debug: { reason: "missing price for some night", perNightBreakdown } });
      }
      nightTotal += perNightSurcharge;
      total += nightTotal;
      perNightBreakdown.push({ date: dateIso(cur), perUnit, nightTotal });
      cur = addDays(cur, 1);
    }

    // first night
    let firstNight = 0;
    const firstDay = new Date(start);
    for (const h of pricingHouses) {
      firstNight += (getPriceForDate(h, firstDay) ?? 0);
    }
    firstNight += perNightSurcharge;

    return NextResponse.json({
      total: Math.round(total),
      first: Math.round(firstNight),
      nights,
      extraGuests,
      includedBase,
      variable: false,
      // debug output for your development/testing — remove in production if you want
      perNightBreakdown,
    });
  } catch (err) {
    console.error("price route error:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
