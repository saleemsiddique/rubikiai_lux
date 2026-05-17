// app/api/houses/list/route.ts
import { NextResponse } from "next/server";
import admin from "@/lib/firebase-admin";
import { cookies } from "next/headers";

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;
  try {
    const decoded = await admin.auth().verifySessionCookie(session, false);
    if (!(decoded as any).admin) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const db = admin.firestore();

    // Puedes ajustar el limit si esperas más
    const snap = await db.collection("houses").get(); // sin orderBy para evitar índices
    const items = snap.docs.map((d) => {
      const x = d.data() || {};
      return {
        id: d.id,
        name: x.name || "",
        alias: x.alias || "",
        type: x.type ?? null,
        maxGuests: x.maxGuests ?? null,
        // no traemos pricePerNight aquí para mantener la lista ligera
      };
    });

    // Ordenamos por nombre en servidor
    items.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

    return NextResponse.json({ items });
  } catch (e: any) {
    console.error("[api/houses/list] error:", e);
    return NextResponse.json({ error: e?.message || "List error" }, { status: 500 });
  }
}
