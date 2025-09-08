import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { collection, getDocs } from "firebase/firestore";

export async function GET() {
  try {
    // Referencia a la colección
    const reservationsRef = collection(db, "reservations");
    // Traer todos los documentos
    const snapshot = await getDocs(reservationsRef);
    // Mapear a array
    const reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ reservations });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch reservations" }, { status: 500 });
  }
}
