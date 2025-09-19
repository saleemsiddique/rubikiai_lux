// app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import admin from "firebase-admin";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

if (!admin.apps.length) {
  const cred = process.env.FIREBASE_ADMIN_SDK ? JSON.parse(process.env.FIREBASE_ADMIN_SDK) : undefined;
  admin.initializeApp({
    credential: cred ? admin.credential.cert(cred) : admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") || "";
  const buf = await req.arrayBuffer();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(Buffer.from(buf), sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("Webhook signature error:", err?.message);
    return new Response(`Webhook Error: ${err?.message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const reservationId = session.metadata?.reservationId;
      if (!reservationId) return NextResponse.json({ ok: true });

      const resRef = db.collection("reservations").doc(reservationId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(resRef);
        if (!snap.exists) {
          console.warn("Reservation not found (webhook):", reservationId);
          return;
        }
        const data: any = snap.data();
        // opcional: re-check overlap con otras reservas confirmed (omito detalle largo aquí por brevedad)
        tx.update(resRef, {
          status: "confirmed",
          paidAt: admin.firestore.Timestamp.now(),
          stripeSessionId: session.id,
          stripePaymentIntent: session.payment_intent,
        });
      });
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const reservationId = session.metadata?.reservationId;
      if (reservationId) {
        await db.collection("reservations").doc(reservationId).update({ status: "expired" });
      }
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err);
    return new Response("Webhook processing error", { status: 500 });
  }
}
