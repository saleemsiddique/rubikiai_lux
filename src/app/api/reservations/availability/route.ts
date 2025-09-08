// app/api/reservations/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firestore";

function dateOnlyIso(d: Date) {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate: startISO, endDate: endISO, guests, propertyType } = body;

    // Convierte a Date
    const reqStart = new Date(startISO);
    const reqEnd = new Date(endISO);

    const housesRef = collection(db, "houses");
    let housesQueryRef: ReturnType<typeof query> | typeof housesRef = housesRef;
    // Si propertyType distinto de 'todos', filtramos por type exactamente igual
    if (propertyType && propertyType !== "todos") {
      housesQueryRef = query(housesRef, where("type", "==", propertyType));
    }

    const housesSnapshot = await getDocs(housesQueryRef);
    const houses = housesSnapshot.docs.map((doc) => {
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

    const reservationsRef = collection(db, "reservations");

    const availabilityPromises = houses.map(async (house) => {
      // Traemos todas las reservas de esta casa (sin filtros de fecha, para procesar en el servidor)
      const q = query(reservationsRef, where("houseId", "==", house.id));
      const snapshot = await getDocs(q);

      const occupiedDates: Record<string, boolean> = {};
      let hasOverlap = false;

      snapshot.forEach((doc) => {
        const data = doc.data();
        // Asumimos que checkIn/checkOut están en formato "YYYY-MM-DD"
        const resStart = new Date(data.checkIn);
        const resEnd = new Date(data.checkOut);

        // llenar occupiedDates (cada día entre checkIn (inclusive) y checkOut (exclusive))
        const cur = new Date(resStart);
        while (cur < resEnd) {
          occupiedDates[dateOnlyIso(cur)] = true;
          cur.setDate(cur.getDate() + 1);
        }

        // comprobar solapamiento con el rango solicitado
        // consideramos checkOut exclusivo (igual a tu lógica previa)
        if (resStart < reqEnd && resEnd > reqStart) {
          hasOverlap = true;
        }
      });

      const isCapacityOk = (house.maxGuests ?? 0) >= (guests ?? 0);
      const isAvailable = !hasOverlap;

      return {
        ...house,
        occupiedDates, // map YYYY-MM-DD -> true
        isAvailable,
        isCapacityOk,
      };
    });

    const results = await Promise.all(availabilityPromises);

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Availability API error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
