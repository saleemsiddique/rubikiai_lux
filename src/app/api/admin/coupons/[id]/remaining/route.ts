import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import admin, { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params?.id;
    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    // Auth: requiere admin
    const session = (await cookies()).get("session")?.value;
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifySessionCookie(session, true);
    } catch {
      return NextResponse.json({ error: "invalid_session" }, { status: 401 });
    }
    if (!(decoded as any).admin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const remainingRaw = body?.remaining;
    const remaining = Number(remainingRaw);

    if (!Number.isFinite(remaining) || remaining < 0) {
      return NextResponse.json({ error: "invalid_remaining" }, { status: 400 });
    }

    const ref = adminDb.collection("coupons").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await ref.update({
      remaining,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await ref.get();
    const data: any = updated.data();

    return NextResponse.json({
      id: updated.id,
      code: data?.code,
      currency: data?.currency || "EUR",
      unitAmount: Number(data?.unitAmount ?? 0),
      remaining: Number(data?.remaining ?? 0),
      status: String(data?.status || "active"),
      orderId: data?.orderId || null,
      buyerEmail: data?.buyerEmail || null,
      purchasedAtIso: data?.purchasedAt?.toDate ? data.purchasedAt.toDate().toISOString() : null,
      expiresAtIso: data?.expiresAt?.toDate ? data.expiresAt.toDate().toISOString() : null,
    });
  } catch (e: any) {
    console.error("[admin/coupons] update remaining error:", e);
    return NextResponse.json({ error: e?.message || "server_error" }, { status: 500 });
  }
}
