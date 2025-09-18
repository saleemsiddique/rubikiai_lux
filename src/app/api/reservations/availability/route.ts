// app/api/reservations/availability/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

function dateOnlyIso(d: Date) { return d.toISOString().split("T")[0]; }
function toDateOnly(value: any): Date {
  if (!value) return new Date(0);
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    d.setHours(0,0,0,0);
    return d;
  }
  const d = new Date(value);
  d.setHours(0,0,0,0);
  return d;
}
function addDays(d: Date, days: number) { const r = new Date(d); r.setDate(r.getDate()+days); return r; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate: startISO, endDate: endISO, guests, propertyType } = body;
    const reqStart = toDateOnly(startISO);
    const reqEnd = toDateOnly(endISO);
    if (!reqStart || !reqEnd) return NextResponse.json({ error: "Invalid dates" }, { status: 400 });

    let housesQuery = adminDb.collection("houses");
    if (propertyType && propertyType !== "todos") {
      housesQuery = housesQuery.where("type", "==", propertyType) as any;
    }
    const housesSnap = await housesQuery.get();
    const houses = housesSnap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        maxGuests: data.maxGuests,
        images: data.images || [],
        name: data.name,
        type: data.type,
        description: data.description || "",
        pricePerNight: data.pricePerNight || {},
      };
    });

    const reservationsRef = adminDb.collection("reservations");

    const availabilityPromises = houses.map(async (house) => {
      const q = reservationsRef.where("houseId", "==", house.id);
      const snapshot = await q.get();

      const occupiedDates: Record<string, boolean> = {};
      let hasOverlap = false;

      snapshot.forEach((doc) => {
        const data = doc.data() as any;
        const resStartDay = toDateOnly(data.checkIn);
        const resEndDay = toDateOnly(data.checkOut);
        if (!resStartDay || !resEndDay) return;
        const resEndExclusive = addDays(resEndDay, 0);

        let cur = new Date(resStartDay);
        while (cur < addDays(resEndExclusive, 1)) {
          occupiedDates[dateOnlyIso(cur)] = true;
          cur.setDate(cur.getDate() + 1);
        }

        if (resStartDay < addDays(reqEnd, 1) && addDays(resEndExclusive, 1) > reqStart) {
          hasOverlap = true;
        }
      });

      const isCapacityOk = (house.maxGuests ?? 0) >= (guests ?? 0);
      const isAvailable = !hasOverlap;

      return { ...house, occupiedDates, isAvailable, isCapacityOk };
    });

    const results = await Promise.all(availabilityPromises);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("Availability API error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
