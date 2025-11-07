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
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// YYYY-MM-DD -> Date local 00:00
function isoToLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
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

/**
 * Nuevo comportamiento (compatible):
 * - upsert: { "2025-12-24": 220 } -> guardamos en specialPrices.singleDays
 * - delete: ["2025-12-24"] -> borramos de specialPrices.singleDays
 * - rangeUpsert: { start, end, price } -> añadimos a specialPrices.ranges (no expandimos por performance)
 * - rangeDelete: { start, end } -> eliminamos ranges con mismo start+end (match exact)
 *
 * Si el documento tiene formato legacy (flat map), lo convertimos a singleDays y trabajamos sobre ello.
 */

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

    // Validar upsert puntual
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

    // Validar delete puntual
    const cleanDelete: string[] = Array.isArray(toDelete) ? toDelete.slice() : [];
    for (const d of cleanDelete) {
      if (!isIsoDate(d)) {
        return NextResponse.json({ error: `Fecha inválida para eliminar: ${d}` }, { status: 400 });
      }
    }

    // Validar rangeUpsert
    let rangeToAdd: { start: string; end: string; price: number } | null = null;
    if (rangeUpsert) {
      const { start, end, price } = rangeUpsert;
      if (!isIsoDate(start) || !isIsoDate(end)) {
        return NextResponse.json({ error: "rangeUpsert.start y end deben ser YYYY-MM-DD" }, { status: 400 });
      }
      const numPrice = Number(String(price).replace(",", "."));
      if (!Number.isFinite(numPrice) || numPrice < 0) {
        return NextResponse.json({ error: "rangeUpsert.price debe ser un número ≥ 0" }, { status: 400 });
      }
      if (new Date(end).getTime() < new Date(start).getTime()) {
        return NextResponse.json({ error: "rangeUpsert.end debe ser >= start" }, { status: 400 });
      }
      rangeToAdd = { start, end, price: numPrice };
    }

    // Validar rangeDelete
    let rangeDeleteObj: { start: string; end: string } | null = null;
    if (rangeDelete) {
      const { start, end } = rangeDelete;
      if (!isIsoDate(start) || !isIsoDate(end)) {
        return NextResponse.json({ error: "rangeDelete.start y end deben ser YYYY-MM-DD" }, { status: 400 });
      }
      rangeDeleteObj = { start, end };
    }

    // ---- Read current doc and compute new specialPrices object ----
    const db = admin.firestore();
    const { id } = await context.params;
    const ref = db.collection("houses").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Casa no encontrada." }, { status: 404 });
    }

    const data = snap.data() || {};
    // normalizar legacy flat map -> singleDays
    const currentSpecials: {
      singleDays: Record<string, number>;
      ranges: Array<{ start: string; end: string; price: number }>;
    } = { singleDays: {}, ranges: [] };

    if (data.specialPrices) {
      const sp = data.specialPrices;
      // caso legacy: plain map YYYY-MM-DD -> number
      const isPlainMap =
        sp &&
        typeof sp === "object" &&
        !Array.isArray(sp) &&
        !sp.singleDays &&
        !sp.ranges;
      if (isPlainMap) {
        for (const [k, v] of Object.entries(sp)) {
          if (isIsoDate(k) && typeof v === "number") currentSpecials.singleDays[k] = v;
        }
      } else {
        // new shape: try to pick singleDays & ranges if present
        if (sp.singleDays && typeof sp.singleDays === "object") {
          for (const [k, v] of Object.entries(sp.singleDays)) {
            if (isIsoDate(k) && typeof v === "number") currentSpecials.singleDays[k] = v;
          }
        }
        if (Array.isArray(sp.ranges)) {
          for (const r of sp.ranges) {
            if (r && typeof r.start === "string" && typeof r.end === "string" && typeof r.price === "number") {
              // only accept well-formed entries
              currentSpecials.ranges.push({ start: r.start, end: r.end, price: r.price });
            }
          }
        }
      }
    }

    // apply single upserts
    for (const [iso, price] of Object.entries(cleanUpsert)) {
      currentSpecials.singleDays[iso] = price;
    }

    // apply single deletes
    for (const iso of cleanDelete) {
      if (currentSpecials.singleDays.hasOwnProperty(iso)) {
        delete currentSpecials.singleDays[iso];
      }
    }

    // apply range upsert (append if not duplicate exact)
    if (rangeToAdd) {
      const exists = currentSpecials.ranges.some(
        (r) => r.start === rangeToAdd!.start && r.end === rangeToAdd!.end && r.price === rangeToAdd!.price
      );
      if (!exists) {
        currentSpecials.ranges.push(rangeToAdd);
      }
    }

    // apply range delete (remove ranges that match start+end exactly)
    if (rangeDeleteObj) {
      currentSpecials.ranges = currentSpecials.ranges.filter(
        (r) => !(r.start === rangeDeleteObj!.start && r.end === rangeDeleteObj!.end)
      );
    }

    // write back entire specialPrices object (merge)
    const nextSpecials: any = {};
    // only include singleDays if some exist
    if (Object.keys(currentSpecials.singleDays).length) nextSpecials.singleDays = currentSpecials.singleDays;
    // only include ranges if some exist
    if (currentSpecials.ranges.length) nextSpecials.ranges = currentSpecials.ranges;

    // If neither exists, remove specialPrices field (delete)
    if (Object.keys(nextSpecials).length === 0) {
      await ref.update({ specialPrices: admin.firestore.FieldValue.delete() });
    } else {
      await ref.update({ specialPrices: nextSpecials });
    }

    // devolver doc actualizado (shallow)
    const updated = await ref.get();
    const udata = updated.data() || {};
    const payload = {
      id: updated.id,
      alias: udata.alias || "",
      name: udata.name || "",
      type: udata.type ?? null,
      maxGuests: udata.maxGuests ?? null,
      images: Array.isArray(udata.images) ? udata.images : [],
      pricePerNight:
        typeof udata.pricePerNight === "object" && udata.pricePerNight
          ? udata.pricePerNight
          : {},
      specialPrices:
        typeof udata.specialPrices === "object" && udata.specialPrices
          ? udata.specialPrices
          : {},
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    console.error("[api/admin/houses/[id]/special-prices] error:", e);
    return NextResponse.json({ error: e?.message || "Update error" }, { status: 500 });
  }
}
