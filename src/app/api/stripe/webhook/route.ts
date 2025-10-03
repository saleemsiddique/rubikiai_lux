// app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import admin from "firebase-admin";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

if (!admin.apps.length) {
  const cred = process.env.FIREBASE_ADMIN_SDK ? JSON.parse(process.env.FIREBASE_ADMIN_SDK) : undefined;
  admin.initializeApp({ credential: cred ? admin.credential.cert(cred) : admin.credential.applicationDefault() });
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
      const type = session.metadata?.type;

      if (type === "coupon") {
        const orderId = session.metadata?.orderId;
        if (!orderId) return NextResponse.json({ ok: true });
        const ref = db.collection("coupon_orders").doc(orderId);
        await ref.set(
          {
            stripeSessionId: session.id,
            buyerEmail: session.customer_details?.email || session.customer_email || null,
            updatedAt: admin.firestore.Timestamp.now(),
          },
          { merge: true }
        );
        return NextResponse.json({ received: true });
      }

      // === RESERVATION FLOW ===
      const reservationId = session.metadata?.reservationId;
      if (!reservationId) return NextResponse.json({ ok: true });

      const resRef = db.collection("reservations").doc(reservationId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(resRef);
        if (!snap.exists) return;
        const data: any = snap.data();

        // Sincroniza datos básicos
        const updates: any = {};
        const paymentIntentId = session.payment_intent ? String(session.payment_intent) : null;
        const customerId = typeof session.customer === "string" ? session.customer : null;
        const customerEmail = session.customer_details?.email || session.customer_email || null;

        if (!data.stripeSessionId) updates.stripeSessionId = session.id;
        if (!data.stripePaymentIntentId && paymentIntentId) updates.stripePaymentIntentId = paymentIntentId;
        if (customerId && !data.stripeCustomerId) updates.stripeCustomerId = customerId;
        if (customerEmail && !data.customerEmail) updates.customerEmail = customerEmail;

        // Descuento del cupón (si no se ha hecho)
        const couponInfo = data?.coupon || null;
        if (couponInfo && couponInfo.id && Number.isFinite(Number(couponInfo.amountApplied)) && !couponInfo.deductedAt) {
          const couponRef = db.collection("coupons").doc(String(couponInfo.id));
          const cSnap = await tx.get(couponRef);
          if (cSnap.exists) {
            const cData: any = cSnap.data();
            const remaining = Number(cData?.remaining ?? 0);
            const amount = Math.floor(Number(couponInfo.amountApplied));
            if (amount > 0) {
              if (remaining < amount) {
                updates.coupon = {
                  ...couponInfo,
                  deductionError: "insufficient_remaining_at_webhook",
                  deductionErrorAt: admin.firestore.Timestamp.now(),
                };
              } else {
                tx.update(couponRef, {
                  remaining: remaining - amount,
                  lastUsedAt: admin.firestore.Timestamp.now(),
                });
                updates.coupon = {
                  ...couponInfo,
                  deductedAt: admin.firestore.Timestamp.now(),
                };
                const movRef = couponRef.collection("movements").doc();
                tx.set(movRef, {
                  type: "reservation",
                  reservationId,
                  amount,
                  createdAt: admin.firestore.Timestamp.now(),
                  checkoutSessionId: session.id,
                });
              }
            }
          } else {
            updates.coupon = {
              ...couponInfo,
              deductionError: "coupon_not_found_at_webhook",
              deductionErrorAt: admin.firestore.Timestamp.now(),
            };
          }
        }

        // FREE-ORDER: si el total de la sesión es 0 (o metadata lo indica), marca reserved aquí
        const isFreeOrder =
          (session as any)?.amount_total === 0 ||
          session.metadata?.noPayment === "true";

        if (isFreeOrder) {
          // si sigue pendiente, confirmar la reserva ya aquí
          if (data.status === "pending" || data.status === "capturing") {
            updates.status = "reserved";
            updates.paidAt = admin.firestore.Timestamp.now();
            updates.expiresAt = admin.firestore.FieldValue.delete();
          }
        }

        if (Object.keys(updates).length) {
          tx.update(resRef, updates);
        }
      });

      return NextResponse.json({ received: true });
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const type = session.metadata?.type;
      if (type === "coupon") {
        const orderId = session.metadata?.orderId;
        if (orderId) await db.collection("coupon_orders").doc(orderId).update({ status: "expired" });
        return NextResponse.json({ received: true });
      }

      const reservationId = (event.data.object as any)?.metadata?.reservationId;
      if (reservationId) {
        await db.collection("reservations").doc(reservationId).update({
          status: "expired",
          paymentRejectedReason: "checkout_session_expired",
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err);
    return new Response("Webhook processing error", { status: 500 });
  }
}
