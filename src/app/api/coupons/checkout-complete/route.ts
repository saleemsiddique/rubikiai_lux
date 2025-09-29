import { NextResponse } from "next/server";
import Stripe from "stripe";
import admin, { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

function getSessionPaymentIntentId(session: Stripe.Checkout.Session | null): string | null {
  if (!session) return null;
  if (typeof session.payment_intent === "string") return session.payment_intent;
  if (session.payment_intent && typeof (session.payment_intent as any).id === "string") {
    return (session.payment_intent as Stripe.PaymentIntent).id;
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/coupons/cancel?reason=missing_session`);
    }

    let session: Stripe.Checkout.Session | null = null;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {}

    const orderId = session?.metadata?.orderId ?? url.searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/coupons/cancel?reason=no_order`);
    }

    const orderRef = adminDb.collection("coupon_orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/coupons/cancel?orderId=${orderId}&reason=not_found`);
    }

    const order: any = orderSnap.data();
    if (order.status === "completed") {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/coupons/thanks?orderId=${orderId}`);
    }

    // Verify payment
    const piId = getSessionPaymentIntentId(session);
    if (!piId) {
      await orderRef.update({ status: "error", error: "missing_payment_intent", stripeSessionId: session?.id ?? null });
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/coupons/cancel?orderId=${orderId}&reason=no_payment_intent`);
    }

    const pi = await stripe.paymentIntents.retrieve(piId);
    if (pi.status !== "succeeded" && pi.status !== "requires_capture" && pi.status !== "processing") {
      await orderRef.update({ status: "error", error: `unexpected_pi_status_${pi.status}` });
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/coupons/cancel?orderId=${orderId}&reason=pi_status`);
    }

    // Create coupon documents
    const quantity: number = Number(order.quantity || 1) || 1;
    const unitAmount: number = Number(order.unitAmount);
    const purchasedAt = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

    const buyerEmail =
      session?.customer_details?.email || session?.customer_email || (pi.receipt_email ?? null) || null;

    const batch = adminDb.batch();
    const codes: Array<{ code: string; amount: number; remaining: number; id: string }> = [];

    for (let i = 0; i < quantity; i++) {
      const code =
        Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      const cRef = adminDb.collection("coupons").doc();
      batch.set(cRef, {
        status: "active",
        code,
        currency: "EUR",
        unitAmount,
        remaining: unitAmount,
        purchasedAt,
        expiresAt,
        stripeSessionId: session?.id ?? null,
        stripePaymentIntentId: piId,
        orderId,
        buyerEmail: buyerEmail || null,
      });
      codes.push({ code, amount: unitAmount, remaining: unitAmount, id: cRef.id });
    }

    batch.update(orderRef, {
      status: "completed",
      completedAt: admin.firestore.Timestamp.now(),
      stripeSessionId: session?.id ?? null,
      stripePaymentIntentId: piId,
      buyerEmail: buyerEmail || null,
    });

    await batch.commit();

    // Send email via central route
    if (buyerEmail) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "coupon_purchase",
            to: buyerEmail,
            data: {
              unitAmount,
              quantity,
              currency: "EUR",
              codes: codes.map((c) => ({ code: c.code, remaining: c.remaining })),
              expiresAt: expiresAt.toDate().toISOString().slice(0, 10),
            },
          }),
        });
      } catch (e) {
        console.error("central email call failed:", e);
        await orderRef.update({
          emailSendErrorAt: admin.firestore.Timestamp.now(),
          emailSendError: String((e as any)?.message ?? e),
        });
      }
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/coupons/thanks?orderId=${orderId}`);
  } catch (err) {
    console.error("coupons/checkout-complete error:", err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/coupons/cancel?reason=server_error`);
  }
}
