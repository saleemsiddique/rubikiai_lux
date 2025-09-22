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
  // payment_intent puede ser string | PaymentIntent | null
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
      { cancellation_reason: "abandoned" }, // params
      { idempotencyKey: `cancel_${reservationId}_${paymentIntentId}_${extra}` } // requestOptions
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

// --------------------------------------------------------------------------

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reason=missing_session`);
    }

    // Recuperar session de Stripe para obtener reservationId y payment_intent
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

    // If already reserved -> redirect to thanks
    if (data.status === "reserved") {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/thanks?reservationId=${reservationId}&session_id=${encodeURIComponent(sessionId)}`
      );
    }

    // If already expired -> redirect cancel
    if (data.status === "expired") {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}&reason=expired`);
    }

    // If pending -> check expiresAt.
    const nowMs = Date.now();
    const expiresAtDate =
      data.expiresAt && typeof data.expiresAt.toDate === "function" ? data.expiresAt.toDate() : null;

    if (expiresAtDate && expiresAtDate.getTime() <= nowMs) {
      // mark expired and cancel payment_intent if exists
      await resRef.update({
        status: "expired",
        expiredAt: admin.firestore.Timestamp.now(),
        paymentRejectedReason: "expired_on_redirect",
        stripeSessionId: stripeSession?.id ?? null,
      });

      // cancel the payment_intent if present (libera el hold)
      const sessionPI = getSessionPaymentIntentId(stripeSession);
      const paymentIntentId = sessionPI ?? (data.stripePaymentIntentId ? String(data.stripePaymentIntentId) : null);

      await safeCancelPI(paymentIntentId, reservationId, resRef, "expired_on_redirect");

      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}&reason=expired`);
    }

    // TX set status -> 'capturing' ONLY if still pending and not expired
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

    // 2) Perform capture
    const sessionPI = getSessionPaymentIntentId(stripeSession);
    const paymentIntentId = sessionPI ?? (data.stripePaymentIntentId ? String(data.stripePaymentIntentId) : null);

    if (!paymentIntentId) {
      // restore to pending and redirect to cancel
      await resRef.update({
        status: "pending",
        stripeSessionId: stripeSession?.id ?? null,
        paymentCaptureError: "missing_payment_intent",
        paymentCaptureErrorAt: admin.firestore.Timestamp.now(),
      });

      // Intenta liberar si había un PI guardado en el doc
      await safeCancelPI(data?.stripePaymentIntentId ? String(data.stripePaymentIntentId) : null, reservationId, resRef, "missing_pi");

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}&reason=no_payment_intent`
      );
    }

    let captured: Stripe.Response<Stripe.PaymentIntent> | null = null;
    try {
      captured = await stripe.paymentIntents.capture(
        paymentIntentId,
        {}, // params
        { idempotencyKey: `capture_${reservationId}_${paymentIntentId}` } // requestOptions
      );
    } catch (err: any) {
      // capture failed -> try to cancel authorization to free hold
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

    // 3) finalize reservation: mark reserved and remove expiresAt
    await db.runTransaction(async (tx) => {
      const s = await tx.get(resRef);
      if (!s.exists) throw new Error("Reservation disappeared while finalizing capture");
      const d: any = s.data();
      // only finalize if status is capturing
      if (d.status !== "capturing") {
        // Unexpected state — but we'll not overwrite if it changed
        await tx.update(resRef, {
          stripePaymentIntentId: captured?.id ? String(captured.id) : (d.stripePaymentIntentId || admin.firestore.FieldValue.delete()),
        } as any);
        return;
      }
      const updates: any = {
        status: "reserved",
        paidAt: admin.firestore.Timestamp.now(),
        stripePaymentIntentId: captured?.id ? String(captured.id) : undefined,
        expiresAt: admin.firestore.FieldValue.delete(),
      };
      tx.update(resRef, updates);
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/thanks?reservationId=${reservationId}&session_id=${encodeURIComponent(sessionId)}`
    );
  } catch (err) {
    console.error("checkout-complete error:", err);
    // safe fallback
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/cancel?reason=server_error`);
  }
}
