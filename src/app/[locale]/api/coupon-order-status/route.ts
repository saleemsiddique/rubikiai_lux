// app/api/coupon-order-status/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getTranslations } from 'next-intl/server';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  try {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'api.errors' });
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ error: t('missingOrderId') }, { status: 400 });

    const tryCollections = ["coupon_orders", "coupons_orders", "gc_orders"]; // <- fallback
    let snap: FirebaseFirestore.DocumentSnapshot | null = null;
    for (const col of tryCollections) {
      const s = await adminDb.collection(col).doc(orderId).get();
      if (s.exists) { snap = s; break; }
    }

    if (!snap || !snap.exists) return NextResponse.json({ error: t('orderNotFound') }, { status: 404 });

    const data: any = snap.data();
    const status: 'pending' | 'completed' | 'expired' | 'error' =
      data?.status === 'completed' ? 'completed' :
      data?.status === 'expired'   ? 'expired'   :
      data?.status === 'error'     ? 'error'     : 'pending';

    return NextResponse.json({ order: { status } });
  } catch (e: any) {
    console.error("coupon-order-status error:", e);
    return NextResponse.json({ error: e?.message ?? "server_error" }, { status: 500 });
  }
}
