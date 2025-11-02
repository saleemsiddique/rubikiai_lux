// app/api/montonio/order-status/route.ts
import { NextResponse } from "next/server";
import admin, { adminDb as db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ error: "missing orderId" }, { status: 400 });
    }

    const snap = await db.collection("coupon_orders").doc(orderId).get();
    if (!snap.exists) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }
    const data = snap.data() || {};
    // devolver un objeto pequeño
    return NextResponse.json({
      status: data.status || "pending",
      buyerEmail: data.buyerEmail || null,
      unitAmount: data.unitAmount || null,
      quantity: data.quantity || 1,
      montonioOrderUuid: data.montonioOrderUuid || null,
      montonioPaymentUrl: data.montonioPaymentUrl || null,
      lastWebhookAt: data.lastWebhookAt || null,
    });
  } catch (err: any) {
    console.error("order-status error:", err);
    return NextResponse.json({ error: err?.message || "internal_error" }, { status: 500 });
  }
}
