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

// --- helpers ---------------------------------------------------------------

function getSessionPaymentIntentId(session: Stripe.Checkout.Session | null): string | null {
  if (!session) return null;
  if (typeof session.payment_intent === "string") return session.payment_intent;
  if (session.payment_intent && typeof (session.payment_intent as any).id === "string") {
    return (session.payment_intent as Stripe.PaymentIntent).id;
  }
  return null;
}

async function safeCancelPI(
  paymentIntentId: string | null,
  reservationId: string,
  resRef: FirebaseFirestore.DocumentReference,
  extra: string
) {
  if (!paymentIntentId) return;
  try {
    await stripe.paymentIntents.cancel(
      paymentIntentId,
      { cancellation_reason: "abandoned" },
      { idempotencyKey: `cancel_${reservationId}_${paymentIntentId}_${extra}` }
    );
    await resRef.update({
      paymentIntentCancelled: true,
      cancelledPaymentIntentId: paymentIntentId,
      cancelledAt: admin.firestore.Timestamp.now(),
    });
  } catch (e: any) {
    console.error("Failed to cancel PaymentIntent:", e);
    await resRef.update({
      paymentIntentCancelError: String(e?.message ?? e),
      paymentIntentCancelErrorAt: admin.firestore.Timestamp.now(),
    });
  }
}

/**
 * Busca el mejor email posible para recibo (Checkout → Customer → PaymentMethod → Charge).
 * Devuelve también el customerId si existe.
 */
async function findBestReceiptEmail(
  stripe: Stripe,
  session: Stripe.Checkout.Session | null,
  paymentIntentId: string
): Promise<{ email: string | null; customerId: string | null }> {
  const checkoutEmail = session?.customer_details?.email || session?.customer_email || null;

  let customerEmail: string | null = null;
  let customerId: string | null = null;
  if (typeof session?.customer === "string") {
    customerId = session.customer;
    try {
      const cust = await stripe.customers.retrieve(session.customer);
      if ((cust as any).deleted !== true) {
        customerEmail = (cust as Stripe.Customer).email || null;
      }
    } catch {
      // no-op
    }
  }

  let pmEmail: string | null = null;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["payment_method"] });
    const pm = pi.payment_method as Stripe.PaymentMethod | null;
    if (pm && typeof pm !== "string") {
      pmEmail = pm.billing_details?.email || null;
    }
    if (!pmEmail && pi.latest_charge && typeof pi.latest_charge === "string") {
      const ch = await stripe.charges.retrieve(pi.latest_charge);
      pmEmail = ch.billing_details?.email || ch.receipt_email || null;
    } else if (!pmEmail && pi.latest_charge && typeof pi.latest_charge !== "string") {
      const ch = pi.latest_charge as Stripe.Charge;
      pmEmail = ch.billing_details?.email || ch.receipt_email || null;
    }
  } catch {
    // no-op
  }

  const email = checkoutEmail || customerEmail || pmEmail || null;
  return { email, customerId };
}

// --------------------------------------------------------------------------

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reason=missing_session`);
    }

    // Recuperar sesión de Stripe para obtener reservationId, payment_intent y datos de cliente
    let stripeSession: Stripe.Checkout.Session | null = null;
    try {
      stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      console.warn("Could not retrieve stripe session:", String(err));
    }

    const reservationId = stripeSession?.metadata?.reservationId ?? url.searchParams.get("reservationId");
    if (!reservationId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reason=no_reservation`);
    }

    const resRef = db.collection("reservations").doc(reservationId);
    const snap = await resRef.get();
    if (!snap.exists) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}&reason=not_found`);
    }
    const data: any = snap.data();

    // Si ya está reservado → gracias
    if (data.status === "reserved") {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/thanks?reservationId=${reservationId}&session_id=${encodeURIComponent(sessionId)}`
      );
    }

    // Si ya está expirado → cancel
    if (data.status === "expired") {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}&reason=expired`);
    }

    // Si está pendiente → comprobar expiresAt
    const nowMs = Date.now();
    const expiresAtDate =
      data.expiresAt && typeof data.expiresAt.toDate === "function" ? data.expiresAt.toDate() : null;

    if (expiresAtDate && expiresAtDate.getTime() <= nowMs) {
      // Marcar expirado y cancelar el PI (liberar hold) si existe
      await resRef.update({
        status: "expired",
        expiredAt: admin.firestore.Timestamp.now(),
        paymentRejectedReason: "expired_on_redirect",
        stripeSessionId: stripeSession?.id ?? null,
      });

      const sessionPI = getSessionPaymentIntentId(stripeSession);
      const paymentIntentId = sessionPI ?? (data.stripePaymentIntentId ? String(data.stripePaymentIntentId) : null);

      await safeCancelPI(paymentIntentId, reservationId, resRef, "expired_on_redirect");

      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}&reason=expired`);
    }

    // FREE-ORDER: si la sesión es 0€, confirmar sin capturar
    const isFreeOrder =
      (stripeSession as any)?.amount_total === 0 ||
      stripeSession?.metadata?.noPayment === "true";

    if (isFreeOrder) {
      await db.runTransaction(async (tx) => {
        const s = await tx.get(resRef);
        if (!s.exists) throw new Error("Reservation disappeared during free capture lock");
        const d: any = s.data();
        if (d.status !== "pending") return; // si alguien ya la movió, no sobreescribas
        tx.update(resRef, {
          status: "reserved",
          stripeSessionId: stripeSession?.id ?? null,
          paidAt: admin.firestore.Timestamp.now(),
          expiresAt: admin.firestore.FieldValue.delete(),
        });
      });

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/thanks?reservationId=${reservationId}&session_id=${encodeURIComponent(sessionId)}`
      );
    }

    // Lock de captura: pasar a 'capturing' solo si sigue 'pending' y no expiró
    await db.runTransaction(async (tx) => {
      const s = await tx.get(resRef);
      if (!s.exists) throw new Error("Reservation disappeared during capture lock");
      const d: any = s.data();
      if (d.status !== "pending") {
        throw new Error(`Reservation status is not pending during capture lock: ${d.status}`);
      }
      if (d.expiresAt && typeof d.expiresAt.toDate === "function") {
        const ex = d.expiresAt.toDate();
        if (ex.getTime() <= Date.now()) {
          throw new Error("Reservation expired during capture lock");
        }
      }
      tx.update(resRef, { status: "capturing", stripeSessionId: stripeSession?.id ?? null });
    });

    // 2) Captura (sólo flow con pago)
    const sessionPI = getSessionPaymentIntentId(stripeSession);
    const paymentIntentId = sessionPI ?? (data.stripePaymentIntentId ? String(data.stripePaymentIntentId) : null);

    if (!paymentIntentId) {
      // Volver a pending y cancelar el flujo
      await resRef.update({
        status: "pending",
        stripeSessionId: stripeSession?.id ?? null,
        paymentCaptureError: "missing_payment_intent",
        paymentCaptureErrorAt: admin.firestore.Timestamp.now(),
      });

      await safeCancelPI(data?.stripePaymentIntentId ? String(data.stripePaymentIntentId) : null, reservationId, resRef, "missing_pi");

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}&reason=no_payment_intent`
      );
    }

    // Asegurar email en el PaymentIntent antes de capturar (para que Stripe envíe recibo al capturar)
    const { email: receiptEmail, customerId } = await findBestReceiptEmail(stripe, stripeSession, paymentIntentId);
    if (receiptEmail) {
      try {
        await stripe.paymentIntents.update(paymentIntentId, { receipt_email: receiptEmail });
      } catch (e) {
        console.warn("Could not set receipt_email on PaymentIntent:", e);
      }
    }

    let captured: Stripe.Response<Stripe.PaymentIntent> | null = null;
    try {
      captured = await stripe.paymentIntents.capture(
        paymentIntentId,
        {},
        { idempotencyKey: `capture_${reservationId}_${paymentIntentId}` }
      );
    } catch (err: any) {
      console.error("PaymentIntent capture failed:", err);

      await safeCancelPI(paymentIntentId, reservationId, resRef, "capture_failed");

      await resRef.update({
        status: "expired",
        paymentCaptureError: String(err?.message ?? err),
        paymentCaptureErrorAt: admin.firestore.Timestamp.now(),
      });

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}&reason=capture_failed`
      );
    }

    // 3) Finalizar reserva
    await db.runTransaction(async (tx) => {
      const s = await tx.get(resRef);
      if (!s.exists) throw new Error("Reservation disappeared while finalizing capture");
      const d: any = s.data();

      const updates: any = {
        stripePaymentIntentId: captured?.id ? String(captured.id) : (d.stripePaymentIntentId || admin.firestore.FieldValue.delete()),
      };

      if ((stripeSession as any)?.customer && !d.stripeCustomerId) updates.stripeCustomerId = String((stripeSession as any).customer);
      if (receiptEmail && !d.customerEmail) updates.customerEmail = receiptEmail;

      if (d.status !== "capturing") {
        await tx.update(resRef, updates as any);
        return;
      }

      Object.assign(updates, {
        status: "reserved",
        paidAt: admin.firestore.Timestamp.now(),
        expiresAt: admin.firestore.FieldValue.delete(),
      });

      tx.update(resRef, updates);
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/thanks?reservationId=${reservationId}&session_id=${encodeURIComponent(sessionId)}`
    );
  } catch (err) {
    console.error("checkout-complete error:", err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reason=server_error`);
  }
}
