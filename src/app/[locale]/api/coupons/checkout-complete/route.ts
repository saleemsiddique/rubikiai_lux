// app/api/coupons/checkout-complete/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  try {
    const { locale } = await params;
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/coupons/cancel?reason=missing_session`);
    }

    // Solo obtenemos el orderId para redirigir (la emisión de cupones se hace en el webhook)
    let session: Stripe.Checkout.Session | null = null;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      // si falla, igualmente llevamos al "thanks" sin bloquear la UX
    }
    const orderId = session?.metadata?.orderId ?? url.searchParams.get("orderId") ?? "";

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/coupons/thanks${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ""}`
    );
  } catch (err) {
    console.error("coupons/checkout-complete error:", err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/coupons/cancel?reason=server_error`);
  }
}
