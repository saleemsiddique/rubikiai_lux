// app/api/admin/revenue/reservations/route.ts
import { NextResponse } from "next/server";
import admin, { adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

function parseDateISO(d: string) {
  // "YYYY-MM-DD" -> Date local 00:00
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  const [_, y, mo, da] = m.map(Number) as any;
  return new Date(y, mo - 1, da, 0, 0, 0, 0);
}
function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function tsToIso(v: any): string | null {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return null;
}

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;
  if (!session) throw new Error("unauthenticated");
  const decoded = await admin.auth().verifySessionCookie(session, true);
  if (!(decoded as any).admin) throw new Error("forbidden");
  return decoded;
}

// Estados que reconocemos en el sistema ahora mismo
const ALLOWED_STATUSES = new Set([
  "reserved", // pagada / confirmada
  "admin",    // bloqueo interno sin pago
  "complete", // estancia finalizada/cobro final cerrado
  "canceled", // cancelada
]);

/**
 * GET /api/admin/revenue/reservations
 * query:
 *  - start=YYYY-MM-DD (inclusive, por campo "by")
 *  - end=YYYY-MM-DD (inclusive) -> internamente se hace exclusivo +1 día
 *  - by=createdAt|paidAt|checkIn|checkOut (default: createdAt)
 *  - status=reserved,complete (por defecto esas dos; deben ser válidos según ALLOWED_STATUSES)
 *    Nota: normalmente para revenue quieres "reserved" (depósito/pago inicial) y "complete" (total cobrado)
 *  - houseId=... (opcional)
 *  - limit=2000 (opcional, seguridad; hard cap 5000)
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return bad("unauthorized", 401);
  }

  try {
    const url = new URL(req.url);
    const start = url.searchParams.get("start") || "";
    const end = url.searchParams.get("end") || "";
    const by = (url.searchParams.get("by") || "createdAt").toLowerCase();
    const statusesRaw = url.searchParams.get("status") || "reserved,complete";
    const houseId = url.searchParams.get("houseId") || "";
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "2000", 10),
      5000
    );

    if (!start || !end)
      return bad("start and end are required (YYYY-MM-DD)");

    const startD = parseDateISO(start);
    const endD = parseDateISO(end);
    if (!startD || !endD) return bad("Invalid start or end");

    // end exclusive (+1 día porque end es inclusivo en UI)
    const endExclusive = new Date(endD);
    endExclusive.setDate(endExclusive.getDate() + 1);

    // normalizamos los statuses pedidos
    const statuses = statusesRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // validación: no dejamos estados que ya no existen ("pending", "expired"...)
    for (const st of statuses) {
      if (!ALLOWED_STATUSES.has(st)) {
        return bad(`Invalid status '${st}'`, 400);
      }
    }

    const col = adminDb.collection("reservations");
    const resultsMap = new Map<string, any>();

    // Para evitar índices compuestos raros (in + rango), hacemos 1 query por status
    for (const st of statuses) {
      let q: FirebaseFirestore.Query = col.where("status", "==", st);

      if (houseId) {
        q = q.where("houseId", "==", houseId);
      }

      if (by === "createdat" || by === "paidat") {
        const field = by === "createdat" ? "createdAt" : "paidAt";
        // createdAt / paidAt son Timestamp -> rango por Timestamp
        q = q
          .where(field, ">=", startD)
          .where(field, "<", endExclusive)
          .orderBy(field, "desc");
      } else if (by === "checkin" || by === "checkout") {
        const field = by === "checkin" ? "checkIn" : "checkOut";
        // checkIn/checkOut son strings "YYYY-MM-DD", lexicográfico funciona
        const startStr = toISODateLocal(startD);
        const endStrExclusive = toISODateLocal(endExclusive);
        q = q
          .where(field, ">=", startStr)
          .where(field, "<", endStrExclusive)
          .orderBy(field, "desc");
      } else {
        return bad("Invalid 'by' parameter");
      }

      const snap = await q.limit(limit).get();
      for (const doc of snap.docs) {
        resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
      }
    }

    // Normalización para UI (convertimos Timestamps a ISO string legible)
    const cleaned = Array.from(resultsMap.values()).map((r: any) => ({
      id: String(r.id || ""),
      status: String(r.status || ""),
      checkIn: String(r.checkIn || ""),
      checkOut: String(r.checkOut || ""),
      nights: Number(r.nights ?? 0),
      guests: Number(r.guests ?? 0),
      houseId: r.houseId || null,
      houseIds: Array.isArray(r.houseIds) ? r.houseIds : null,
      customerEmail: r.customerEmail || null,
      currency: r.currency || "EUR",
      total: Number(r.total ?? 0),
      discountedTotal:
        typeof r.discountedTotal === "number" ? r.discountedTotal : null,
      firstNightBase:
        typeof r.firstNightBase === "number" ? r.firstNightBase : null,
      firstNightCharge:
        typeof r.firstNightCharge === "number" ? r.firstNightCharge : null,
      discountedFirst:
        typeof r.discountedFirst === "number" ? r.discountedFirst : null,
      paidInFull: !!r.paidInFull,
      createdAtIso: tsToIso(r.createdAt),
      updatedAtIso: tsToIso(r.updatedAt),
      paidAtIso: tsToIso(r.paidAt),
      coupon: r.coupon || null,
    }));

    // Orden por fecha (desc) del campo elegido
    cleaned.sort((a: any, b: any) => {
      const fa =
        by === "createdat"
          ? a.createdAtIso
          : by === "paidat"
          ? a.paidAtIso
          : by === "checkin"
          ? a.checkIn
          : a.checkOut;
      const fb =
        by === "createdat"
          ? b.createdAtIso
          : by === "paidat"
          ? b.paidAtIso
          : by === "checkin"
          ? b.checkIn
          : b.checkOut;
      return String(fb || "").localeCompare(String(fa || ""));
    });

    return NextResponse.json({ results: cleaned });
  } catch (e: any) {
    console.error("[revenue/reservations] error:", e);
    return bad(e?.message || "server_error", 500);
  }
}
