// app/api/admin/houses/[id]/special-prices/route.ts
import { NextResponse, NextRequest } from "next/server";
import admin from "@/lib/firebase-admin";
import { cookies } from "next/headers";

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;
  try {
    const decoded = await admin.auth().verifySessionCookie(session, true);
    if (!(decoded as any).admin) return null;
    return decoded;
  } catch {
    return null;
  }
}

function isIsoDate(s: string) {
  // YYYY-MM-DD (sin hora)
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const upsert = (body?.upsert || {}) as Record<string, unknown>;
    const toDelete = (body?.delete || []) as unknown;

    // Validación de "upsert"
    const cleanUpsert: Record<string, number> = {};
    for (const k of Object.keys(upsert)) {
      if (!isIsoDate(k)) {
        return NextResponse.json({ error: `Fecha inválida: ${k} (usa YYYY-MM-DD)` }, { status: 400 });
      }
      const v = Number((upsert as any)[k]);
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: `Valor inválido para ${k}` }, { status: 400 });
      }
      cleanUpsert[k] = v;
    }

    // Validación de "delete"
    const cleanDelete: string[] = Array.isArray(toDelete) ? toDelete : [];
    for (const d of cleanDelete) {
      if (!isIsoDate(d)) {
        return NextResponse.json({ error: `Fecha inválida para eliminar: ${d}` }, { status: 400 });
      }
    }

    const db = admin.firestore();
    const { id } = await context.params;
    const ref = db.collection("houses").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Casa no encontrada." }, { status: 404 });
    }

    const updates: Record<string, any> = {};

    // set/merge de specialPrices.<YYYY-MM-DD>
    for (const [iso, price] of Object.entries(cleanUpsert)) {
      updates[`specialPrices.${iso}`] = price;
    }

    // delete de specialPrices.<YYYY-MM-DD>
    for (const iso of cleanDelete) {
      updates[`specialPrices.${iso}`] = admin.firestore.FieldValue.delete();
    }

    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
    }

    // Devolver doc actualizado (igual estilo que tu /prices)
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
      // ⬇️ incluir specialPrices
      specialPrices: typeof data.specialPrices === "object" && data.specialPrices ? data.specialPrices : {},
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    console.error("[api/admin/houses/[id]/special-prices] error:", e);
    return NextResponse.json({ error: e?.message || "Update error" }, { status: 500 });
  }
}
