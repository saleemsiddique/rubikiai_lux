// app/api/reservations/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firestore";

function dateOnlyIso(d: Date) { return d.toISOString().split("T")[0]; }
function toDateOnly(value: any): Date {
  if (!value) return new Date(0);
  let d: Date;
  if (typeof value.toDate === "function") d = value.toDate();
  else d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, days: number) { const r = new Date(d); r.setDate(r.getDate() + days); return r; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate: startISO, endDate: endISO, guests, propertyType } = body;
    const reqStart = toDateOnly(startISO);
    const reqEndExclusive = toDateOnly(endISO); // convertimos a day-only
    // normalizar: hacemos end exclusivo sumando 1 día para comparar noches
    const reqEnd = addDays(reqEndExclusive, 0); // ya tratamos exclusión más abajo si queremos

    const housesRef = collection(db, "houses");
    let housesQueryRef: ReturnType<typeof query> | typeof housesRef = housesRef;
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
      const q = query(reservationsRef, where("houseId", "==", house.id));
      const snapshot = await getDocs(q);

      const occupiedDates: Record<string, boolean> = {};
      let hasOverlap = false;

      snapshot.forEach((doc) => {
        const data = doc.data() as any;
        // Normalizamos checkIn/checkOut a day-only:
        const resStartDay = toDateOnly(data.checkIn);
        const resEndDay = toDateOnly(data.checkOut);
        // Para tratar checkOut como exclusivo (no duplicar noche), podemos usar resEndExclusive = resEndDay
        const resEndExclusive = addDays(resEndDay, 0);

        // Llenamos occupiedDates: desde resStartDay (incl) hasta resEndExclusive (incl/excl según tu convención).
        // Si quieres incluir la noche del día de checkOut cuando checkOut lleva hora 23:00, ajusta aquí.
        let cur = new Date(resStartDay);
        // Usamos cur < addDays(resEndExclusive, 1) para asegurar inclusión de la última noche si procede.
        while (cur < addDays(resEndExclusive, 1)) {
          occupiedDates[dateOnlyIso(cur)] = true;
          cur.setDate(cur.getDate() + 1);
        }

        // comprobar solapamiento con el rango solicitado (comparando day-only)
        // si resStartDay < reqEndExclusive && addDays(resEndExclusive,1) > reqStart  -> solapa
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
