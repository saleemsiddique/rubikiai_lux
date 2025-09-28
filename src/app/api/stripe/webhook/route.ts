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
      if (!reservationId) {
        return NextResponse.json({ ok: true });
      }

      const resRef = db.collection("reservations").doc(reservationId);
      let paymentIntentId: string | null = session.payment_intent ? String(session.payment_intent) : null;

      // NEW: captar datos de cliente/email para sincronizarlos
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const customerEmail =
        session.customer_details?.email ||
        session.customer_email ||
        null;

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(resRef);
        if (!snap.exists) {
          console.warn("Reservation not found (webhook):", reservationId);
          return;
        }

        const data: any = snap.data();

        // If already reserved or capturing, skip or sync stripeSessionId
        if (data?.status === "reserved" || data?.status === "capturing") {
          const updates: any = {};
          if (!data.stripeSessionId) updates.stripeSessionId = session.id;
          if (!data.stripePaymentIntentId && paymentIntentId) updates.stripePaymentIntentId = paymentIntentId;
          if (customerId && !data.stripeCustomerId) updates.stripeCustomerId = customerId; // NEW
          if (customerEmail && !data.customerEmail) updates.customerEmail = customerEmail; // NEW
          if (Object.keys(updates).length) tx.update(resRef, updates);
          return;
        }

        // If already expired, ensure stripeSessionId saved
        if (data?.status === "expired") {
          const updates: any = { stripeSessionId: session.id };
          if (paymentIntentId && !data.paymentIntentCancelled) {
            updates.paymentIntentCancelAttempted = true;
          }
          tx.update(resRef, updates);
          return;
        }

        // Only for pending: check expiresAt
        if (data?.status === "pending") {
          if (data.expiresAt && typeof data.expiresAt.toDate === "function") {
            const expiresDate = data.expiresAt.toDate();
            if (expiresDate.getTime() < Date.now()) {
              tx.update(resRef, {
                status: "expired",
                stripeSessionId: session.id,
                paymentRejectedReason: "session_expired",
                expiredAtProcessing: admin.firestore.Timestamp.now(),
              });
              return;
            }
          }
          // session completed y reserva aún válida -> sincroniza ids
          const updates: any = {
            stripeSessionId: session.id,
          };
          if (paymentIntentId) updates.stripePaymentIntentId = paymentIntentId;
          if (customerId) updates.stripeCustomerId = customerId;       // NEW
          if (customerEmail) updates.customerEmail = customerEmail;     // NEW
          tx.update(resRef, updates);
          return;
        }

        // fallback: sync session id
        tx.update(resRef, { stripeSessionId: session.id });
      });

      // NO capturamos aquí; la captura se hace en /api/checkout-complete
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const reservationId = session.metadata?.reservationId;
      if (reservationId) {
        await db.collection("reservations").doc(reservationId).update({
          status: "expired",
          paymentRejectedReason: "checkout_session_expired", // NEW: motivo informativo
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err);
    return new Response("Webhook processing error", { status: 500 });
  }
}
