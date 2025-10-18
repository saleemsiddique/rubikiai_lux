// app/api/reservations/price/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

const EXTRA_GUEST_PRICE = 40; // € per extra person per night

function toDateOnly(v: any) {
  if (!v) return null;
  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    d.setHours(0,0,0,0);
    return d;
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0,0,0,0);
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
  const map = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  return map[date.getDay()];
}
function getPriceForDate(house: any, d: Date): number | null {
  if (!house || !house.pricePerNight) return null;
  const key = weekdayKey(d);
  const val = house.pricePerNight[key];
  return typeof val === "number" ? val : null;
}

async function fetchReservationsForHouse(houseId: string) {
  const snap = await adminDb.collection("reservations").where("houseId", "==", houseId).get();
  return snap.docs.map((d) => d.data());
}

async function fetchHouseDoc(id: string) {
  const docSnap = await adminDb.collection("houses").doc(id).get();
  if (!docSnap.exists) return null;
  return { id: docSnap.id, ...(docSnap.data() || {}) };
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
      ids = String(houseId).split("__").map(s => s.trim()).filter(Boolean);
    } else if (houseParam) {
      const snap = await adminDb.collection("houses").where("alias", "==", houseParam).get();
      if (snap.empty) return NextResponse.json({ error: "house not found" }, { status: 404 });
      ids = [snap.docs[0].id];
    } else {
      return NextResponse.json({ error: "houseId or houseParam required" }, { status: 400 });
    }

    ids = Array.from(new Set(ids));
    if (ids.length === 0) return NextResponse.json({ error: "no house ids" }, { status: 400 });

    // fetch docs
    const housesData: any[] = [];
    for (const id of ids) {
      const h = await fetchHouseDoc(id);
      if (!h) return NextResponse.json({ error: `house ${id} not found` }, { status: 404 });
      housesData.push(h);
    }

    // build occupied union
    const occupiedUnion = new Set<string>();
    for (const id of ids) {
      const reservations = await fetchReservationsForHouse(id);
      reservations.forEach((r: any) => {
        const ci = toDateOnly(r.checkIn);
        const co = toDateOnly(r.checkOut);
        if (!ci || !co) return;
        let cur = new Date(ci);
        while (cur < co) {
          occupiedUnion.add(dateIso(cur));
          cur = addDays(cur, 1);
        }
      });
    }

    let cur = new Date(start);
    while (cur < end) {
      if (occupiedUnion.has(dateIso(cur))) {
        return NextResponse.json({ error: "Selected dates are unavailable" }, { status: 409 });
      }
      cur = addDays(cur, 1);
    }

    // pricing selection logic (igual que tú)
    const nights = Math.round((end.getTime() - start.getTime()) / (1000*60*60*24));
    const guestsNum = Math.max(0, Number(guests) || 0);
    let pricingHouses = housesData.slice();

    if (ids.length > 0) {
      const firstId = ids[0];
      const firstDoc = housesData.find(h => h.id === firstId);
      if (firstDoc) {
        const includedFirst = typeof firstDoc.includedGuests === "number"
          ? firstDoc.includedGuests
          : (typeof firstDoc.maxGuests === "number" ? firstDoc.maxGuests : 2);
        const maxFirst = typeof firstDoc.maxGuests === "number" ? firstDoc.maxGuests : Math.max(includedFirst, includedFirst+2);
        if (guestsNum <= maxFirst) pricingHouses = [firstDoc];
      }
    }

    const includedBase = pricingHouses.reduce((acc, h) => {
      if (typeof h.includedGuests === "number") return acc + h.includedGuests;
      return acc + 2;
    }, 0);
    const extraGuests = Math.max(0, guestsNum - includedBase);
    const perNightSurcharge = extraGuests * EXTRA_GUEST_PRICE;

    // calc total
    let total = 0;
    const perNightBreakdown: any[] = [];
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

    let firstNight = 0;
    const firstDay = new Date(start);
    for (const h of pricingHouses) firstNight += (getPriceForDate(h, firstDay) ?? 0);
    firstNight += perNightSurcharge;

    return NextResponse.json({
      total: total,
      first: firstNight,
      nights,
      extraGuests,
      includedBase,
      variable: false,
      perNightBreakdown,
    });
  } catch (err) {
    console.error("price route error:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
