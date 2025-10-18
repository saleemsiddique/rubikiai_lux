// app/api/coupons/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import admin, { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const unitAmount = Number(body?.unitAmount);
    const quantity = Math.max(1, parseInt(String(body?.quantity || 1), 10));

    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return NextResponse.json({ error: "Importe inválido" }, { status: 400 });
    }

    const unitAmountCents = Math.round(unitAmount * 100);

    // Creamos orden 'pending'
    const orderRef = adminDb.collection("coupon_orders").doc();
    const now = admin.firestore.Timestamp.now();

    await orderRef.set({
      status: "pending",
      unitAmount,
      unitAmountCents,
      quantity,
      currency: "EUR",
      createdAt: now,
    });

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_creation: "always",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: `Rubikiai Lux Coupon`,
                description: quantity > 1 ? `${quantity} x ${unitAmount.toFixed(2)}€` : `${unitAmount.toFixed(2)}€`,
              },
            unit_amount: unitAmountCents,
            },
            quantity,
          },
        ],
        metadata: {
          type: "coupon",               // clave para el webhook
          orderId: orderRef.id,
          unitAmount: String(unitAmount),
          quantity: String(quantity),
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/coupons/checkout-complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/coupons/cancel?orderId=${orderRef.id}`,
      },
      { idempotencyKey: orderRef.id }
    );

    await orderRef.update({ stripeSessionId: session.id, stripeCheckoutUrl: session.url });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("coupons/create-checkout error:", err);
    return NextResponse.json({ error: err?.message ?? "internal_error" }, { status: 500 });
  }
}
