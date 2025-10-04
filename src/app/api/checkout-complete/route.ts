// app/api/checkout-complete/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

if (!admin.apps.length) {
  const cred = process.env.FIREBASE_ADMIN_SDK ? JSON.parse(process.env.FIREBASE_ADMIN_SDK) : undefined;
  admin.initializeApp({
    credential: cred ? admin.credential.cert(cred) : admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reason=missing_session`);
    }

    // Recuperar la sesión para extraer metadata (no mutamos nada aquí)
    let stripeSession: Stripe.Checkout.Session | null = null;
    try {
      stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      // si falla, seguimos con fallback al query param
    }

    const reservationId = stripeSession?.metadata?.reservationId ?? url.searchParams.get("reservationId");
    if (!reservationId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reason=no_reservation`);
    }

    const resRef = db.collection("reservations").doc(reservationId);
    const snap = await resRef.get();
    if (!snap.exists) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}&reason=not_found`
      );
    }
    const data: any = snap.data();

    // Si ya está reservado → gracias
    if (data.status === "reserved") {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/thanks?reservationId=${reservationId}&session_id=${encodeURIComponent(
          sessionId
        )}`
      );
    }

    // Si ya expiró → cancel
    if (data.status === "expired") {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}&reason=expired`
      );
    }

    // En cualquier otro estado (pending/capturing), el webhook se encarga.
    // Redirigimos a "thanks" y el front puede mostrar estado "procesando".
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/thanks?reservationId=${reservationId}&session_id=${encodeURIComponent(
        sessionId
      )}`
    );
  } catch (err) {
    console.error("checkout-complete error:", err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reason=server_error`);
  }
}
