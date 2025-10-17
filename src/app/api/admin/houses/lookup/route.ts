// app/api/houses/lookup/route.ts
import { NextResponse } from "next/server";
import admin from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) {
      return NextResponse.json({ error: "Parámetro 'q' requerido (id o alias)." }, { status: 400 });
    }

    const db = admin.firestore();

    // Intento por ID directo
    const byId = await db.collection("houses").doc(q).get();
    let snap = byId;
    if (!byId.exists) {
      // Si no es un id, probamos por alias exacto
      const byAlias = await db.collection("houses").where("alias", "==", q).limit(1).get();
      if (byAlias.empty) {
        return NextResponse.json({ error: "Casa no encontrada." }, { status: 404 });
      }
      snap = byAlias.docs[0];
    }

    const data = snap.data() || {};
    const payload = {
      id: snap.id,
      alias: data.alias || "",
      name: data.name || "",
      type: data.type ?? null,
      maxGuests: data.maxGuests ?? null,
      images: Array.isArray(data.images) ? data.images : [],
      pricePerNight: typeof data.pricePerNight === "object" && data.pricePerNight
        ? data.pricePerNight
        : {},
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    console.error("[api/houses/lookup] error:", e);
    return NextResponse.json({ error: e?.message || "Lookup error" }, { status: 500 });
  }
}
