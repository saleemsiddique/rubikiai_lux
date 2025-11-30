// app/api/checkout-complete/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin"; // <-- usa la ruta correcta según tu proyecto

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

// ya no hace falta volver a inicializar aquí, lo hace lib/firebase-admin.ts
const db = adminDb;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params;

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/cancel?reason=missing_session`);
    }

    // Recuperar la sesión para extraer metadata (no mutamos nada aquí)
    let stripeSession: Stripe.Checkout.Session | null = null;
    try {
      stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      console.error("checkout-complete error:", err);
    }

    const reservationId = stripeSession?.metadata?.reservationId ?? url.searchParams.get("reservationId");
    if (!reservationId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/cancel?reason=no_reservation`);
    }

    const resRef = db.collection("reservations").doc(reservationId);
    const snap = await resRef.get();
    if (!snap.exists) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/cancel?reservationId=${reservationId}&reason=not_found`
      );
    }
    const data: any = snap.data();

    // Si ya está reservado → gracias
    if (data.status === "reserved") {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/thanks?reservationId=${reservationId}&session_id=${encodeURIComponent(
          sessionId
        )}`
      );
    }

    // Si ya expiró → cancel
    if (data.status === "expired") {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/cancel?reservationId=${reservationId}&reason=expired`
      );
    }

    // En cualquier otro estado (pending/capturing), el webhook se encarga.
    // Redirigimos a "thanks" y el front puede mostrar estado "procesando".
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/thanks?reservationId=${reservationId}&session_id=${encodeURIComponent(
        sessionId
      )}`
    );
  } catch (err) {
    console.error("checkout-complete error:", err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/${locale}/cancel?reason=server_error`);
  }
}
