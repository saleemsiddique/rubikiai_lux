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
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  const [_, y, mo, da] = m.map(Number) as any;
  return new Date(y, mo - 1, da, 0, 0, 0, 0);
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

/**
 * GET /api/admin/revenue/coupon-orders
 * query:
 *  - start=YYYY-MM-DD (inclusive)
 *  - end=YYYY-MM-DD (inclusive)
 *  - by=completedAt|createdAt (default: completedAt)
 *  - status=completed (default)
 *  - limit=2000
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
    const by = (url.searchParams.get("by") || "completedAt").toLowerCase();
    const status = url.searchParams.get("status") || "completed";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "2000", 10), 5000);

    if (!start || !end) return bad("start and end are required (YYYY-MM-DD)");

    const startD = parseDateISO(start);
    const endD = parseDateISO(end);
    if (!startD || !endD) return bad("Invalid start or end");
    const endExclusive = new Date(endD);
    endExclusive.setDate(endExclusive.getDate() + 1);

    const col = adminDb.collection("coupon_orders");
    let q: FirebaseFirestore.Query = col.where("status", "==", status);

    const field = by === "createdat" ? "createdAt" : "completedAt";
    q = q.where(field, ">=", startD).where(field, "<", endExclusive).orderBy(field, "desc");

    const snap = await q.limit(limit).get();

    const list = snap.docs.map((d) => {
      const r: any = d.data();
      return {
        id: d.id,
        status: String(r.status || ""),
        currency: r.currency || "EUR",
        quantity: Number(r.quantity ?? 1),
        unitAmount: Number(r.unitAmount ?? 0),
        unitAmountCents: Number(r.unitAmountCents ?? Math.round((Number(r.unitAmount ?? 0) || 0) * 100)),
        buyerEmail: r.buyerEmail || null,
        stripeSessionId: r.stripeSessionId || null,
        stripePaymentIntentId: r.stripePaymentIntentId || null,
        stripeCheckoutUrl: r.stripeCheckoutUrl || null,
        createdAtIso: tsToIso(r.createdAt),
        completedAtIso: tsToIso(r.completedAt),
        lastWebhookAtIso: tsToIso(r.lastWebhookAt),
        revenue: Number(r.unitAmount ?? 0) * Number(r.quantity ?? 1),
      };
    });

    return NextResponse.json({ results: list });
  } catch (e: any) {
    console.error("[revenue/coupon-orders] error:", e);
    return bad(e?.message || "server_error", 500);
  }
}