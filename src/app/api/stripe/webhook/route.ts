// app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import admin from "firebase-admin";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

if (!admin.apps.length) {
  const cred = process.env.FIREBASE_ADMIN_SDK
    ? JSON.parse(process.env.FIREBASE_ADMIN_SDK)
    : undefined;
  admin.initializeApp({
    credential: cred
      ? admin.credential.cert(cred)
      : admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

/* ---------- helpers ---------- */

function getSessionPaymentIntentId(
  session: Stripe.Checkout.Session | null
): string | null {
  if (!session) return null;
  if (typeof session.payment_intent === "string") return session.payment_intent;
  if (
    session.payment_intent &&
    typeof (session.payment_intent as any).id === "string"
  ) {
    return (session.payment_intent as Stripe.PaymentIntent).id;
  }
  return null;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function makeCode(): string {
  const chunk = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${chunk()}-${chunk()}`;
}

// cancelar PaymentIntent para liberar la autorización si no vamos a capturar
async function safeCancelPI(
  paymentIntentId: string | null,
  reservationId: string,
  reason: string
) {
  if (!paymentIntentId) return;
  try {
    await stripe.paymentIntents.cancel(
      paymentIntentId,
      { cancellation_reason: "abandoned" },
      {
        idempotencyKey: `cancel_${reservationId}_${paymentIntentId}_${reason}`,
      }
    );
  } catch (e) {
    console.error("Failed to cancel PaymentIntent:", e);
  }
}

/**
 * Descuenta saldo de cupón en Firestore y devuelve el bloque `coupon`
 * actualizado (con deductedAt o con error).
 *
 * Recibe:
 * - couponId
 * - couponCode
 * - couponAmountApplied (euros en string)
 * - reservationId
 * - checkoutSessionId
 *
 * IMPORTANTE: debe llamarse DENTRO de una transaction.
 */
async function applyCouponInTx(
  tx: FirebaseFirestore.Transaction,
  {
    couponId,
    couponCode,
    couponAmountApplied,
    reservationId,
    checkoutSessionId,
  }: {
    couponId: string;
    couponCode: string;
    couponAmountApplied: string;
    reservationId: string;
    checkoutSessionId: string;
  }
) {
  const amountNumber = Number(couponAmountApplied);
  const couponRef = db.collection("coupons").doc(String(couponId));
  const cSnap = await tx.get(couponRef);
  if (!cSnap.exists) {
    return {
      id: couponId,
      code: couponCode,
      amountApplied: amountNumber,
      deductionError: "coupon_not_found_at_webhook",
      deductionErrorAt: admin.firestore.Timestamp.now(),
    };
  }

  const cData: any = cSnap.data();
  const remaining = Number(cData?.remaining ?? 0);

  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    // cantidad inválida -> no hacemos nada
    return {
      id: couponId,
      code: couponCode,
      amountApplied: amountNumber,
      deductionError: "invalid_amount_at_webhook",
      deductionErrorAt: admin.firestore.Timestamp.now(),
    };
  }

  if (remaining < amountNumber) {
    // no hay saldo suficiente
    return {
      id: couponId,
      code: couponCode,
      amountApplied: amountNumber,
      deductionError: "insufficient_remaining_at_webhook",
      deductionErrorAt: admin.firestore.Timestamp.now(),
    };
  }

  // ok -> restar saldo
  tx.update(couponRef, {
    remaining: remaining - amountNumber,
    lastUsedAt: admin.firestore.Timestamp.now(),
  });

  // registrar movimiento
  const movRef = couponRef.collection("movements").doc();
  tx.set(movRef, {
    type: "reservation",
    reservationId,
    amount: amountNumber,
    createdAt: admin.firestore.Timestamp.now(),
    checkoutSessionId,
  });

  return {
    id: couponId,
    code: couponCode,
    amountApplied: amountNumber,
    deductedAt: admin.firestore.Timestamp.now(),
  };
}

/**
 * Marca un descuento porcentual como usado dentro de la misma transacción.
 * No resta saldo, solo marca used=true y registra movimiento.
 *
 * Recibe:
 *  - percentId
 *  - percentCode
 *  - percentValue (porcentaje)
 *  - couponAmountApplied (euros de descuento efectivo)
 *  - reservationId
 *  - checkoutSessionId
 */
async function applyPercentDiscountInTx(
  tx: FirebaseFirestore.Transaction,
  {
    percentId,
    percentCode,
    percentValue,
    couponAmountApplied,
    reservationId,
    checkoutSessionId,
  }: {
    percentId: string;
    percentCode: string;
    percentValue: string;
    couponAmountApplied: string; // euros string
    reservationId: string;
    checkoutSessionId: string;
  }
) {
  const percentRef = db.collection("percentage_discounts").doc(String(percentId));
  const pSnap = await tx.get(percentRef);
  if (!pSnap.exists) {
    return {
      id: percentId,
      code: percentCode,
      percent: Number(percentValue),
      amountApplied: Number(couponAmountApplied) || 0,
      deductionError: "percent_not_found_at_webhook",
      deductionErrorAt: admin.firestore.Timestamp.now(),
    };
  }

  const pData: any = pSnap.data();
  const alreadyUsed = !!pData?.used;

  // Marcamos usado si no lo estaba
  if (!alreadyUsed) {
    tx.update(percentRef, {
      used: true,
      usedAt: admin.firestore.Timestamp.now(),
      lastSentAt: pData?.lastSentAt || admin.firestore.Timestamp.now(),
    });
  }

  // registramos el "movimiento" en subcollection movements (similar a coupons)
  const movRef = percentRef.collection("movements").doc();
  tx.set(movRef, {
    type: "reservation",
    reservationId,
    amountApplied: Number(couponAmountApplied) || 0,
    percentValue: Number(percentValue) || 0,
    createdAt: admin.firestore.Timestamp.now(),
    checkoutSessionId,
  });

  return {
    id: percentId,
    code: percentCode,
    percent: Number(percentValue) || 0,
    amountApplied: Number(couponAmountApplied) || 0,
    deductedAt: admin.firestore.Timestamp.now(),
    // nota: no restamos saldo, solo registramos
  };
}


/* ---------- webhook handler ---------- */

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") || "";
  const buf = await req.arrayBuffer();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(buf),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature error:", err?.message);
    return new Response(`Webhook Error: ${err?.message}`, { status: 400 });
  }

  try {
    // ======================================================
    // ================ CHECKOUT COMPLETED ==================
    // ======================================================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // ¿Es compra de cupón?
      const type = session.metadata?.type;
      if (type === "coupon") {
        // --- LÓGICA CUPONES (la dejé igual, salvo el status final no cambia):
        const orderId = session.metadata?.orderId;
        if (!orderId) return NextResponse.json({ ok: true });

        const orderRef = db.collection("coupon_orders").doc(orderId);
        const paymentIntentId = getSessionPaymentIntentId(session);
        const buyerEmail =
          session.customer_details?.email ||
          session.customer_email ||
          null;

        // Paso 1: asegurar que coupon_orders está en "processing"
        const result = await db.runTransaction(async (tx) => {
          const snap = await tx.get(orderRef);
          if (!snap.exists) {
            const quantity =
              parseInt(String(session.metadata?.quantity || "1"), 10) || 1;
            const unitAmount =
              Number(session.metadata?.unitAmount || 0) || 0;
            tx.set(orderRef, {
              status: "processing",
              unitAmount,
              unitAmountCents: Math.round(unitAmount * 100),
              quantity,
              currency: "EUR",
              createdAt: admin.firestore.Timestamp.now(),
              stripeSessionId: session.id,
              stripePaymentIntentId: paymentIntentId || null,
              buyerEmail: buyerEmail || null,
            });
            return { quantity, unitAmount, alreadyCompleted: false };
          } else {
            const data: any = snap.data();
            if (data.status === "completed") {
              return {
                quantity: Number(data.quantity || 1),
                unitAmount: Number(data.unitAmount || 0),
                alreadyCompleted: true,
              };
            }
            const quantity = Number.isFinite(Number(data.quantity))
              ? Number(data.quantity)
              : parseInt(
                String(session.metadata?.quantity || "1"),
                10
              ) || 1;
            const unitAmount = Number.isFinite(Number(data.unitAmount))
              ? Number(data.unitAmount)
              : Number(session.metadata?.unitAmount || 0) || 0;

            tx.update(orderRef, {
              status: "processing",
              stripeSessionId: session.id,
              stripePaymentIntentId: paymentIntentId || null,
              buyerEmail: data.buyerEmail || buyerEmail || null,
              unitAmount,
              quantity,
            });

            return { quantity, unitAmount, alreadyCompleted: false };
          }
        });

        if (result.alreadyCompleted) {
          return NextResponse.json({ received: true });
        }

        // Paso 2: crear códigos de cupón reales
        const purchasedAt = admin.firestore.Timestamp.now();
        const expiresAt = admin.firestore.Timestamp.fromDate(
          addMonths(new Date(), 12)
        );
        const quantity = result.quantity;
        const unitAmount = result.unitAmount;

        const batch = db.batch();
        const createdCodes: Array<{ code: string; remaining: number }> = [];

        for (let i = 0; i < quantity; i++) {
          const cRef = db.collection("coupons").doc(`${orderId}_${i}`);
          const cSnap = await cRef.get();
          if (!cSnap.exists) {
            const code = makeCode();
            batch.set(cRef, {
              status: "active",
              code,
              currency: "EUR",
              unitAmount,
              remaining: unitAmount,
              purchasedAt,
              expiresAt,
              stripeSessionId: session.id,
              stripePaymentIntentId: paymentIntentId || null,
              orderId,
              buyerEmail: buyerEmail || null,
              createdByWebhook: true,
            });
            createdCodes.push({ code, remaining: unitAmount });
          } else {
            const cData: any = cSnap.data();
            createdCodes.push({
              code: String(cData.code),
              remaining: Number(
                cData.remaining ?? unitAmount
              ),
            });
          }
        }

        batch.update(orderRef, {
          status: "completed",
          completedAt: admin.firestore.Timestamp.now(),
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId || null,
          buyerEmail: buyerEmail || null,
          lastWebhookAt: admin.firestore.Timestamp.now(),
        });

        await batch.commit();

        // Paso 3: email con los códigos
        if (buyerEmail) {
          try {
            await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  type: "coupon_purchase",
                  to: buyerEmail,
                  data: {
                    unitAmount,
                    quantity,
                    currency: "EUR",
                    codes: createdCodes,
                    expiresAt: expiresAt
                      .toDate()
                      .toISOString()
                      .slice(0, 10),
                  },
                }),
              }
            );
          } catch (e: any) {
            console.error(
              "coupon email send failed:",
              e?.message || e
            );
            await orderRef.update({
              emailSendErrorAt:
                admin.firestore.Timestamp.now(),
              emailSendError: String(e?.message ?? e),
            });
          }
        }

        return NextResponse.json({ received: true });
      }

      // ----------------- RESERVA NORMAL -----------------

      // 1. Recuperamos metadata que mandamos en create-checkout-session
      const reservationId = session.metadata?.reservationId;
      if (!reservationId) {
        return NextResponse.json({ ok: true });
      }

      const resRef = db.collection("reservations").doc(reservationId);

      // Datos principales
      const rawValue = session.metadata?.rawValue || "";
      const houseIdsCsv = session.metadata?.houseIds || "";
      const houseIds = houseIdsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const checkIn = session.metadata?.checkIn || "";
      const checkOut = session.metadata?.checkOut || "";
      const nights = Number(session.metadata?.nights || 0);

      const guestsNum = Number(session.metadata?.guests || 0);
      const includedBase = Number(session.metadata?.includedBase || 0);
      const extraGuests = Number(session.metadata?.extraGuests || 0);

      const totalNightsOnly = Number(
        session.metadata?.totalNightsOnly || 0
      );
      const firstNightCharge = Number(
        session.metadata?.firstNightCharge || 0
      );
      const discountedFirst = Number(
        session.metadata?.discountedFirst || 0
      );

      const jacuzziEnabled =
        session.metadata?.jacuzziEnabled === "true";
      const jacuzziFee = Number(session.metadata?.jacuzziFee || 0);

      const grandTotal = Number(session.metadata?.grandTotal || 0);
      const discountedGrandTotal = Number(
        session.metadata?.discountedGrandTotal || 0
      );
      const currency = session.metadata?.currency || "EUR";

      const discountKind = session.metadata?.discountKind || ""; // "value" | "percent" | ""
      const couponId = session.metadata?.couponId || "";
      const couponCode = session.metadata?.couponCode || "";
      const percentId = session.metadata?.percentId || "";
      const percentCode = session.metadata?.percentCode || "";
      const percentValue = session.metadata?.percentValue || "";
      const couponAmountApplied =
        session.metadata?.couponAmountApplied || "";


      const app_user_id = session.metadata?.app_user_id || "";

      const customerEmailFromMeta =
        session.metadata?.customerEmail || "";
      const customerNameFromMeta =
        session.metadata?.customerName || "";
      const customerPhoneFromMeta =
        session.metadata?.customerPhone || "";
      const arrivalTime = session.metadata?.arrivalTime || "";
      const comment = session.metadata?.comment || "";

      // También pillamos info directa de Stripe por si hay mejor email
      const stripePaymentIntentId =
        getSessionPaymentIntentId(session);
      const stripeCustomerId =
        typeof session.customer === "string"
          ? session.customer
          : null;
      const stripeCheckoutEmail =
        session.customer_details?.email ||
        session.customer_email ||
        null;

      // 2. Creamos / mergeamos la reserva en Firestore con status "reserved"
      //    y descontamos cupón dentro de UNA MISMA transacción
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(resRef);
        const existsAlready = snap.exists;
        const nowTs = admin.firestore.Timestamp.now();

        const baseReservationPayload: any = {
          houseId:
            houseIds.length === 1
              ? houseIds[0]
              : houseIds.join("__"),
          houseIds,
          checkIn,
          checkOut,
          nights,
          guests: guestsNum,
          includedBase,
          extraGuests,
          totalNightsOnly,
          firstNightCharge,
          discountedFirst,
          jacuzzi: jacuzziEnabled
            ? { enabled: true, fee: jacuzziFee }
            : { enabled: false, fee: 0 },
          jacuzziFee,
          grandTotal,
          discountedGrandTotal,
          currency,

          status: "reserved",
          createdAt: existsAlready
            ? snap.data()?.createdAt || nowTs
            : nowTs,
          paidAt: nowTs,

          stripeSessionId: session.id,
          stripePaymentIntentId: stripePaymentIntentId || null,
          stripeCustomerId: stripeCustomerId || null,

          customerEmail:
            stripeCheckoutEmail ||
            customerEmailFromMeta ||
            null,

          customer: {
            email:
              stripeCheckoutEmail ||
              customerEmailFromMeta ||
              null,
            name: customerNameFromMeta || null,
            phone: customerPhoneFromMeta || null,
            arrivalTime: arrivalTime || null,
            comment: comment || null,
            userId: app_user_id || null,
          },
        };

        // <-- CORREGIDO AQUÍ
        if (
          discountKind === "coupon" && // antes "value"
          couponId &&
          Number(couponAmountApplied) > 0
        ) {
          // Cupón saldo €
          const couponBlock = await applyCouponInTx(tx, {
            couponId,
            couponCode,
            couponAmountApplied,
            reservationId,
            checkoutSessionId: session.id,
          });
          baseReservationPayload.coupon = couponBlock;
        } else if (
          discountKind === "percent" &&
          percentId
        ) {
          // Descuento porcentual
          const percentBlock = await applyPercentDiscountInTx(tx, {
            percentId,
            percentCode,
            percentValue,
            couponAmountApplied,
            reservationId,
            checkoutSessionId: session.id,
          });
          baseReservationPayload.percentDiscount = percentBlock;
        }

        if (!existsAlready) {
          tx.set(resRef, baseReservationPayload);
        } else {
          tx.update(resRef, baseReservationPayload);
        }
      });


      return NextResponse.json({ received: true });
    }

    // ======================================================
    // ================ CHECKOUT EXPIRED ====================
    // ======================================================
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const type = session.metadata?.type;

      // cupón caducado antes de pagar
      if (type === "coupon") {
        const orderId = session.metadata?.orderId;
        if (orderId) {
          await db
            .collection("coupon_orders")
            .doc(orderId)
            .set(
              {
                status: "expired",
                updatedAt: admin.firestore.Timestamp.now(),
              },
              { merge: true }
            );
        }
        return NextResponse.json({ received: true });
      }

      // reserva caducada (el user no pagó)
      const reservationId = session.metadata?.reservationId;
      if (reservationId) {
        const resRef = db.collection("reservations").doc(reservationId);

        // Marcamos la reserva como "canceled"
        await resRef.set(
          {
            status: "canceled",
            paymentRejectedReason: "checkout_session_expired",
            canceledAt: admin.firestore.Timestamp.now(),
          },
          { merge: true }
        );

        // Liberar autorización bancaria si había PI
        const paymentIntentId = getSessionPaymentIntentId(session);
        await safeCancelPI(
          paymentIntentId,
          reservationId,
          "checkout_session_expired"
        );
      }

      return NextResponse.json({ received: true });
    }

    // default
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err);
    return new Response("Webhook processing error", { status: 500 });
  }
}
