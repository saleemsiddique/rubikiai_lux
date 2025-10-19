// app/api/houses/lookup/route.ts
import { NextResponse } from "next/server";
import admin from "@/lib/firebase-admin";

type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function cleanPricePerNight(raw: unknown): Partial<Record<Weekday, number>> {
  const out: Partial<Record<Weekday, number>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!WEEKDAYS.includes(k as Weekday)) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) continue;
    out[k as Weekday] = n;
  }
  return out;
}

function cleanSpecialPrices(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;

  const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ISO_RE.test(k)) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) continue;
    out[k] = n;
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) {
      return NextResponse.json(
        { error: "Parámetro 'q' requerido (id o alias)." },
        { status: 400 }
      );
    }

    const db = admin.firestore();

    // 1) Intento por ID
    let snap = await db.collection("houses").doc(q).get();

    // 2) Si no existe, por alias exacto
    if (!snap.exists) {
      const byAlias = await db
        .collection("houses")
        .where("alias", "==", q)
        .limit(1)
        .get();
      if (byAlias.empty) {
        return NextResponse.json(
          { error: "Casa no encontrada." },
          { status: 404 }
        );
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
      pricePerNight: cleanPricePerNight(data.pricePerNight),
      // ⬇️ NUEVO: incluir y normalizar precios especiales (YYYY-MM-DD -> number)
      specialPrices: cleanSpecialPrices(data.specialPrices),
    };

    // Evita cachear en el panel
    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    console.error("[api/houses/lookup] error:", e);
    return NextResponse.json(
      { error: e?.message || "Lookup error" },
      { status: 500 }
    );
  }
}
