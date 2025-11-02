// app/api/montonio/order-status/route.ts
import { NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const orderRef = db.collection("coupon_orders").doc(orderId);
    const snap = await orderRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const data: any = snap.data();
    const status = data?.status || "pending";

    return NextResponse.json({
      orderId,
      status,
      unitAmount: data?.unitAmount,
      quantity: data?.quantity,
      buyerEmail: data?.buyerEmail,
      createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
      completedAt: data?.completedAt?.toDate?.()?.toISOString() || null,
      montonioOrderUuid: data?.montonioOrderUuid || null,
    });
  } catch (error: any) {
    console.error("Order status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get order status" },
      { status: 500 }
    );
  }
}