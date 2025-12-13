// app/api/admin/houses/[id]/special-prices/route.ts
import { NextResponse, NextRequest } from "next/server";
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

function isIsoDate(s: string) {
  // YYYY-MM-DD (sin hora)
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// YYYY-MM-DD -> Date local 00:00
function isoToLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  // Nota: monthIndex es m-1
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// Date -> YYYY-MM-DD
function dateToIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// genera array de YYYY-MM-DD desde start..end (ambos inclusive)
function expandInclusiveRange(startIso: string, endIso: string): string[] {
  const startD = isoToLocalDate(startIso);
  const endD = isoToLocalDate(endIso);

  if (endD.getTime() < startD.getTime()) {
    throw new Error("El final del rango es anterior al inicio");
  }

  const out: string[] = [];
  const cur = new Date(startD);
  const maxDays = 366; // protección
  let guard = 0;

  while (cur.getTime() <= endD.getTime() && guard < maxDays) {
    out.push(dateToIsoLocal(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }

  if (guard >= maxDays) {
    throw new Error("Rango demasiado largo (max 1 año)");
  }

  return out;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // formato antiguo (un solo día o varios días sueltos):
    const upsert = (body?.upsert || {}) as Record<string, unknown>;
    const toDelete = (body?.delete || []) as unknown;

    // formato nuevo (rango):
    const rangeUpsert = body?.rangeUpsert as
      | { start: string; end: string; price: number | string }
      | undefined;
    const rangeDelete = body?.rangeDelete as
      | { start: string; end: string }
      | undefined;

    // ----- Validar y normalizar "upsert" puntual -----
    const cleanUpsert: Record<string, number> = {};
    for (const k of Object.keys(upsert)) {
      if (!isIsoDate(k)) {
        return NextResponse.json(
          { error: `Fecha inválida: ${k} (usa YYYY-MM-DD)` },
          { status: 400 }
        );
      }
      const v = Number((upsert as any)[k]);
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json(
          { error: `Valor inválido para ${k}` },
          { status: 400 }
        );
      }
      cleanUpsert[k] = v;
    }

    // ----- Validar y normalizar "delete" puntual -----
    const cleanDelete: string[] = Array.isArray(toDelete) ? toDelete : [];
    for (const d of cleanDelete) {
      if (!isIsoDate(d)) {
        return NextResponse.json(
          { error: `Fecha inválida para eliminar: ${d}` },
          { status: 400 }
        );
      }
    }

    // ----- Validar y expandir rangeUpsert -----
    // rangeUpsert: { start, end, price }
    if (rangeUpsert) {
      const { start, end, price } = rangeUpsert;
      if (!isIsoDate(start) || !isIsoDate(end)) {
        return NextResponse.json(
          { error: "rangeUpsert.start y end deben ser YYYY-MM-DD" },
          { status: 400 }
        );
      }
      const numPrice = Number(String(price).replace(",", "."));
      if (!Number.isFinite(numPrice) || numPrice < 0) {
        return NextResponse.json(
          { error: "rangeUpsert.price debe ser un número ≥ 0" },
          { status: 400 }
        );
      }

      let days: string[];
      try {
        days = expandInclusiveRange(start, end);
      } catch (err: any) {
        return NextResponse.json({ error: err?.message || "Rango inválido" }, { status: 400 });
      }

      for (const dayIso of days) {
        cleanUpsert[dayIso] = numPrice;
      }
    }

    // ----- Validar y expandir rangeDelete -----
    // rangeDelete: { start, end }
    if (rangeDelete) {
      const { start, end } = rangeDelete;
      if (!isIsoDate(start) || !isIsoDate(end)) {
        return NextResponse.json(
          { error: "rangeDelete.start y end deben ser YYYY-MM-DD" },
          { status: 400 }
        );
      }

      let days: string[];
      try {
        days = expandInclusiveRange(start, end);
      } catch (err: any) {
        return NextResponse.json({ error: err?.message || "Rango inválido" }, { status: 400 });
      }

      for (const dayIso of days) {
        cleanDelete.push(dayIso);
      }
    }

    // construir update batch
    const db = admin.firestore();
    const { id } = await context.params;
    const ref = db.collection("houses").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Casa no encontrada." }, { status: 404 });
    }

    const updates: Record<string, any> = {};

    // set/merge de specialPrices.<YYYY-MM-DD> = price
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

    // devolver doc actualizado
    const updated = await ref.get();
    const data = updated.data() || {};
    const payload = {
      id: updated.id,
      alias: data.alias || "",
      name: data.name || "",
      type: data.type ?? null,
      maxGuests: data.maxGuests ?? null,
      images: Array.isArray(data.images) ? data.images : [],
      pricePerNight:
        typeof data.pricePerNight === "object" && data.pricePerNight
          ? data.pricePerNight
          : {},
      specialPrices:
        typeof data.specialPrices === "object" && data.specialPrices
          ? data.specialPrices
          : {},
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    console.error("[api/admin/houses/[id]/special-prices] error:", e);
    return NextResponse.json(
      { error: e?.message || "Update error" },
      { status: 500 }
    );
  }
}
