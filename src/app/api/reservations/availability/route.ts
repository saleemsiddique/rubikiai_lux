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

    const OCCUPIED_STATUSES = new Set(["reserved", "paid", "confirmed", "completed"]); // los status que deben contar como ocupados

    const availabilityPromises = houses.map(async (house) => {
      // obtenemos reservas tanto por `houseId` como por `houseIds array-contains`
      const q1 = reservationsRef.where("houseId", "==", house.id).get();
      const q2 = reservationsRef.where("houseIds", "array-contains", house.id).get();
      const [snap1, snap2] = await Promise.all([q1, q2]);

      // merge unique docs
      const docsById = new Map<string, any>();
      snap1.forEach((d) => docsById.set(d.id, d));
      snap2.forEach((d) => docsById.set(d.id, d));

      const occupiedDates: Record<string, boolean> = {};
      let hasOverlap = false;

      docsById.forEach((doc) => {
        const data = doc.data() as any;

        const status = (data.status || "").toString().toLowerCase();
        // ignorar reservas con status que no representen ocupación efectiva
        if (!OCCUPIED_STATUSES.has(status)) {
          // si status === 'pending' o 'expired' (u otros), no las contamos como ocupadas
          return;
        }

        const resStartDay = toDateOnly(data.checkIn);
        const resEndDay = toDateOnly(data.checkOut);
        if (!resStartDay || !resEndDay) return;

        // marcar días ocupados: intervalo [resStartDay, resEndDay) (checkOut exclusivo)
        let cur = new Date(resStartDay);
        while (cur < resEndDay) {
          occupiedDates[dateOnlyIso(cur)] = true;
          cur.setDate(cur.getDate() + 1);
        }

        // comprobar solapamiento con la petición: [resStartDay, resEndDay) vs [reqStart, reqEnd)
        if (resStartDay < reqEnd && resEndDay > reqStart) {
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
