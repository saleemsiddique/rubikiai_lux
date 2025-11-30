// app/api/coupons/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import admin, { adminDb } from "@/lib/firebase-admin";
import { nowInLithuania } from "@/app/[locale]/utils/date-server";
import { getTranslations } from 'next-intl/server';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  try {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'api.errors' });
    const body = await req.json();
    const unitAmount = Number(body?.unitAmount);
    const quantity = Math.max(1, parseInt(String(body?.quantity || 1), 10));
    const buyerEmail = body?.buyerEmail || null;

    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return NextResponse.json({ error: t('invalidAmount') }, { status: 400 });
    }

    const unitAmountCents = Math.round(unitAmount * 100);

    // Creamos orden 'pending'
    const orderRef = adminDb.collection("coupon_orders").doc();
    const now = nowInLithuania();

    await orderRef.set({
      status: "pending",
      unitAmount,
      unitAmountCents,
      quantity,
      currency: "EUR",
      buyerEmail: buyerEmail || null,
      createdAt: now,
    });

    const sessionConfig: any = {
      mode: "payment",
      customer_creation: "always",
      payment_method_types: ["card", "paypal"],
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
        locale: locale || "lt",
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/api/coupons/checkout-complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/coupons/cancel?orderId=${orderRef.id}`,
    };

    // Pre-fill customer email if provided from modal
    if (buyerEmail) {
      sessionConfig.customer_email = buyerEmail;
    }

    const session = await stripe.checkout.sessions.create(
      sessionConfig,
      { idempotencyKey: orderRef.id }
    );

    await orderRef.update({ stripeSessionId: session.id, stripeCheckoutUrl: session.url });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("coupons/create-checkout error:", err);
    // Try to get translations for error message, fallback to err.message
    try {
      const { locale } = await params;
      const t = await getTranslations({ locale, namespace: 'api.errors' });
      return NextResponse.json({ error: err?.message ?? t('internalError') }, { status: 500 });
    } catch {
      return NextResponse.json({ error: err?.message ?? "internal_error" }, { status: 500 });
    }
  }
}
