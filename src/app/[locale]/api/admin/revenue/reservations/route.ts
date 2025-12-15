import { NextResponse } from "next/server";
import admin, { adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

// NOTA: Esta función ya no se usa en revenue, se filtra solo por checkIn
// function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
//   // checkOut es EXCLUSIVA
//   return aStart < bEnd && aEnd > bStart;
// }

function parseDateISO(d: string) {
  // "YYYY-MM-DD" -> Date local 00:00
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  const [_, yStr, moStr, daStr] = m;
  const y = Number(yStr);
  const mo = Number(moStr);
  const da = Number(daStr);
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(da)) return null;
  return new Date(y, mo - 1, da, 0, 0, 0, 0);
}
function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function tsToIso(v: any): string | null {
  if (!v && v !== 0) return null;
  if (typeof v?.toDate === "function") return v.toDate().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return null;
}

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;
  if (!session) throw new Error("unauthenticated");
  const decoded = await admin.auth().verifySessionCookie(session, false);
  if (!(decoded as any).admin) throw new Error("forbidden");
  return decoded;
}

// Estados que reconocemos en el sistema ahora mismo (en minúscula)
const ALLOWED_STATUSES = new Set([
  "reserved", // pagada / confirmada
  "admin", // bloqueo interno sin pago
  "paid", // estancia finalizada/cobro final cerrado
  "complete", // backward compatibility (antiguo status, equivalente a paid)
  "canceled", // cancelada
]);

/**
 * GET /api/admin/revenue/reservations
 * query:
 *  - start=YYYY-MM-DD (inclusive, por campo "by")
 *  - end=YYYY-MM-DD (inclusive) -> internamente se hace exclusivo +1 día
 *  - by=createdAt|paidAt|checkIn|checkOut (default: createdAt)
 *  - status=reserved,paid,complete (por defecto esas; deben ser válidos según ALLOWED_STATUSES)
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
    const byRaw = url.searchParams.get("by") || "";
    const by = String(byRaw).toLowerCase();
    const statusesRaw = url.searchParams.get("status") || "reserved,paid,complete";
    const houseId = url.searchParams.get("houseId") || "";
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "2000", 10),
      5000
    );

    if (!start || !end) return bad("start and end are required (YYYY-MM-DD)");

    const startD = parseDateISO(start);
    const endD = parseDateISO(end);
    if (!startD || !endD) return bad("Invalid start or end");

    // end exclusive (+1 día porque end es inclusivo en UI)
    const endExclusive = new Date(endD);
    endExclusive.setDate(endExclusive.getDate() + 1);

    // normalizamos los statuses pedidos (lowercase)
    const statuses = statusesRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // validación: no dejamos estados que ya no existen
    for (const st of statuses) {
      if (!ALLOWED_STATUSES.has(st)) {
        return bad(`Invalid status '${st}'`, 400);
      }
    }

    const col = adminDb.collection("reservations");
    const resultsMap = new Map<string, any>();

    // Hacemos 1 query por status para evitar combinaciones que piden índice
    for (const st of statuses) {
      let q: FirebaseFirestore.Query = col.where("status", "==", st);

      if (houseId) {
        q = q.where("houseId", "==", houseId);
      }

      // Filtro inicial por checkIn para reducir resultados (igual que bookings/list)
      // checkIn <= end (para capturar reservas que terminan después del inicio del rango)
      q = q.where("checkIn", "<=", end);
      q = q.orderBy("checkIn", "asc").limit(limit);

      const snap = await q.get();
      for (const doc of snap.docs) {
        // Evitar sobrescribir si el mismo doc sale en varios queries
        if (!resultsMap.has(doc.id)) resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
      }
    }

    // Normalización para UI (convertimos Timestamps a ISO string legible)
    const cleaned = Array.from(resultsMap.values()).map((r: any) => {
      const customerMap = r.customer ?? null;
      const emailFlatten = r.email ?? r.customerEmail ?? customerMap?.email ?? null;
      const nameFlatten = r.name ?? customerMap?.name ?? null;
      const phoneFlatten = r.phone ?? customerMap?.phone ?? null;

      return {
        id: String(r.id || ""),
        status: String(r.status || ""),
        checkIn: String(r.checkIn || ""),
        checkOut: String(r.checkOut || ""),
        nights: Number(r.nights ?? 0),
        guests: Number(r.guests ?? 0),
        houseId: r.houseId || null,
        houseIds: Array.isArray(r.houseIds) ? r.houseIds : null,

        // customer map + flatten fields
        customer: customerMap,
        customerEmail: r.customerEmail ?? emailFlatten,
        email: emailFlatten,
        name: nameFlatten,
        phone: phoneFlatten,
        userId: r.userId ?? customerMap?.userId ?? null,
        arrivalTime: r.arrivalTime ?? customerMap?.arrivalTime ?? null,
        comment: r.comment ?? customerMap?.comment ?? null,

        // moneda y precios (nuevos campos)
        currency: r.currency || "EUR",
        totalNightsOnly: Number(r.totalNightsOnly ?? 0),
        grandTotal: typeof r.grandTotal === "number" ? r.grandTotal : Number(r.totalStay ?? r.totalNightsOnly ?? 0),
        totalStay: Number(r.totalStay ?? r.totalNightsOnly ?? 0),

        // cupón de descuento
        coupon: r.coupon ?? null,

        // jacuzzi
        jacuzzi: r.jacuzzi ?? null,
        jacuzziFee: Number(r.jacuzziFee ?? (r.jacuzzi?.fee ?? 0)),

        // extras
        includedBase: Number(r.includedBase ?? 2),
        extraGuests: Number(r.extraGuests ?? 0),

        // primeras noches / cargos
        firstNightCharge: typeof r.firstNightCharge === "number" ? r.firstNightCharge : null,

        // nuevos campos de pago
        payNow: typeof r.payNow === "number" ? r.payNow : null,
        payAtArrival: typeof r.payAtArrival === "number" ? r.payAtArrival : null,
        amountPaid: typeof r.amountPaid === "number" ? r.amountPaid : null,
        paidInFull: typeof r.paidInFull === "boolean" ? r.paidInFull : false,

        // pagos / stripe
        stripeCustomerId: r.stripeCustomerId ?? null,
        stripePaymentIntentId: r.stripePaymentIntentId ?? null,
        stripeSessionId: r.stripeSessionId ?? null,

        // montonio
        montonioOrderUuid: r.montonioOrderUuid ?? null,
        montonioNotification: r.montonioNotification ?? null,

        // timestamps ISO
        createdAtIso: tsToIso(r.createdAt),
        updatedAtIso: tsToIso(r.updatedAt),
        paidAtIso: tsToIso(r.paidAt),
        confirmationEmailSentAtIso: tsToIso(r.confirmationEmailSentAt),
      };
    });

    // Filtro solo por checkIn dentro del rango (específico para revenue)
    const filtered = cleaned.filter(r => {
      const checkIn = String(r.checkIn);
      return checkIn >= start && checkIn <= (end || "9999-12-31");
    });

    // Orden por checkIn (asc)
    filtered.sort((a: any, b: any) => {
      return String(a.checkIn || "").localeCompare(String(b.checkIn || ""));
    });

    return NextResponse.json({ results: filtered });
  } catch (e: any) {
    console.error("[revenue/reservations] error:", e);
    return bad(e?.message || "server_error", 500);
  }
}