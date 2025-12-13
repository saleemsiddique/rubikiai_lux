// app/api/admin/houses/[id]/prices/route.ts
import { NextResponse, NextRequest } from "next/server";
import admin from "@/lib/firebase-admin";
import { cookies } from "next/headers";

type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

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

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const input = (body?.pricePerNight || {}) as Record<string, unknown>;

    // Validación y saneo
    const clean: Partial<Record<Weekday, number>> = {};
    for (const k of Object.keys(input)) {
      if (!WEEKDAYS.includes(k as Weekday)) {
        return NextResponse.json({ error: `Clave inválida: ${k}` }, { status: 400 });
      }
      const v = Number((input as any)[k]);
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: `Valor inválido para ${k}` }, { status: 400 });
      }
      clean[k as Weekday] = v;
    }

    const db = admin.firestore();
    const { id } = await context.params;
    const ref = db.collection("houses").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Casa no encontrada." }, { status: 404 });
    }

    // Merge de los precios existentes con los nuevos
    const current = (snap.data()?.pricePerNight || {}) as Record<string, number>;
    const next = { ...current, ...clean };

    await ref.update({ pricePerNight: next });

    const updated = await ref.get();
    const data = updated.data() || {};
    const payload = {
      id: updated.id,
      alias: data.alias || "",
      name: data.name || "",
      type: data.type ?? null,
      maxGuests: data.maxGuests ?? null,
      images: Array.isArray(data.images) ? data.images : [],
      pricePerNight: typeof data.pricePerNight === "object" && data.pricePerNight ? data.pricePerNight : {},
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    console.error("[api/admin/houses/[id]/prices] error:", e);
    return NextResponse.json({ error: e?.message || "Update error" }, { status: 500 });
  }
}
