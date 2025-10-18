// app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import admin from "firebase-admin";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

if (!admin.apps.length) {
  const cred = process.env.FIREBASE_ADMIN_SDK ? JSON.parse(process.env.FIREBASE_ADMIN_SDK) : undefined;
  admin.initializeApp({ credential: cred ? admin.credential.cert(cred) : admin.credential.applicationDefault() });
}
const db = admin.firestore();

function getSessionPaymentIntentId(session: Stripe.Checkout.Session | null): string | null {
  if (!session) return null;
  if (typeof session.payment_intent === "string") return session.payment_intent;
  if (session.payment_intent && typeof (session.payment_intent as any).id === "string") {
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

// Buscar el mejor email para el recibo
async function findBestReceiptEmail(
  stripeClient: Stripe,
  session: Stripe.Checkout.Session | null,
  paymentIntentId: string
): Promise<{ email: string | null; customerId: string | null }> {
  const checkoutEmail = session?.customer_details?.email || session?.customer_email || null;

  let customerEmail: string | null = null;
  let customerId: string | null = null;
  if (typeof session?.customer === "string") {
    customerId = session.customer;
    try {
      const cust = await stripeClient.customers.retrieve(session.customer);
      if ((cust as any).deleted !== true) {
        customerEmail = (cust as Stripe.Customer).email || null;
      }
    } catch {
      // no-op
    }
  }

  let pmEmail: string | null = null;
  try {
    const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId, { expand: ["payment_method"] });
    const pm = pi.payment_method as Stripe.PaymentMethod | null;
    if (pm && typeof pm !== "string") {
      pmEmail = pm.billing_details?.email || null;
    }
    if (!pmEmail && pi.latest_charge && typeof pi.latest_charge === "string") {
      const ch = await stripeClient.charges.retrieve(pi.latest_charge);
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

// Cancelar PI de forma segura (libera autorización)
async function safeCancelPI(paymentIntentId: string | null, reservationId: string, reason: string) {
  if (!paymentIntentId) return;
  try {
    await stripe.paymentIntents.cancel(
      paymentIntentId,
      { cancellation_reason: "abandoned" },
      { idempotencyKey: `cancel_${reservationId}_${paymentIntentId}_${reason}` }
    );
  } catch (e) {
    console.error("Failed to cancel PaymentIntent:", e);
  }
}

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

      // ===================== CUPONES =====================
      if (type === "coupon") {
        const orderId = session.metadata?.orderId;
        if (!orderId) return NextResponse.json({ ok: true });

        const orderRef = db.collection("coupon_orders").doc(orderId);
        const piId = getSessionPaymentIntentId(session);
        const buyerEmail = session.customer_details?.email || session.customer_email || null;

        const result = await db.runTransaction(async (tx) => {
          const snap = await tx.get(orderRef);
          if (!snap.exists) {
            const quantity = parseInt(String(session.metadata?.quantity || "1"), 10) || 1;
            const unitAmount = Number(session.metadata?.unitAmount || 0) || 0;
            tx.set(orderRef, {
              status: "processing",
              unitAmount,
              unitAmountCents: Math.round(unitAmount * 100),
              quantity,
              currency: "EUR",
              createdAt: admin.firestore.Timestamp.now(),
              stripeSessionId: session.id,
              stripePaymentIntentId: piId || null,
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
              : parseInt(String(session.metadata?.quantity || "1"), 10) || 1;
            const unitAmount = Number.isFinite(Number(data.unitAmount))
              ? Number(data.unitAmount)
              : Number(session.metadata?.unitAmount || 0) || 0;

            tx.update(orderRef, {
              status: "processing",
              stripeSessionId: session.id,
              stripePaymentIntentId: piId || null,
              buyerEmail: (data.buyerEmail || buyerEmail) || null,
              unitAmount,
              quantity,
            });

            return { quantity, unitAmount, alreadyCompleted: false };
          }
        });

        if (result.alreadyCompleted) {
          return NextResponse.json({ received: true });
        }

        const purchasedAt = admin.firestore.Timestamp.now();
        const expiresAt = admin.firestore.Timestamp.fromDate(addMonths(new Date(), 12));
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
              stripePaymentIntentId: piId || null,
              orderId,
              buyerEmail: buyerEmail || null,
              createdByWebhook: true,
            });
            createdCodes.push({ code, remaining: unitAmount });
          } else {
            const cData: any = cSnap.data();
            createdCodes.push({ code: String(cData.code), remaining: Number(cData.remaining ?? unitAmount) });
          }
        }

        batch.update(orderRef, {
          status: "completed",
          completedAt: admin.firestore.Timestamp.now(),
          stripeSessionId: session.id,
          stripePaymentIntentId: piId || null,
          buyerEmail: buyerEmail || null,
          lastWebhookAt: admin.firestore.Timestamp.now(),
        });

        await batch.commit();

        if (buyerEmail) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
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
                  expiresAt: expiresAt.toDate().toISOString().slice(0, 10),
                },
              }),
            });
          } catch (e: any) {
            console.error("coupon email send failed:", e?.message || e);
            await orderRef.update({
              emailSendErrorAt: admin.firestore.Timestamp.now(),
              emailSendError: String(e?.message ?? e),
            });
          }
        }

        return NextResponse.json({ received: true });
      }

      // ===================== RESERVAS =====================
      const reservationId = session.metadata?.reservationId;
      if (!reservationId) return NextResponse.json({ ok: true });

      const resRef = db.collection("reservations").doc(reservationId);

      // ¿Reserva sin pago (0 €)?
      const isFreeOrder =
        (session as any)?.amount_total === 0 ||
        session.metadata?.noPayment === "true";

      const paymentIntentId = getSessionPaymentIntentId(session);
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const customerEmail = session.customer_details?.email || session.customer_email || null;

      // 1) Primer TX: sincroniza datos, deduce cupón y decide si podemos capturar
      let canCapture = false;
      let isAlreadyTerminal = false; // reserved/expired
      let expiredBeforeCapture = false; // <-- NUEVO: para cancelar PI si expira antes de capturar

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(resRef);
        if (!snap.exists) return;
        const data: any = snap.data();

        const updates: any = {};
        if (!data.stripeSessionId) updates.stripeSessionId = session.id;
        if (!data.stripePaymentIntentId && paymentIntentId) updates.stripePaymentIntentId = paymentIntentId;
        if (customerId && !data.stripeCustomerId) updates.stripeCustomerId = customerId;
        if (customerEmail && !data.customerEmail) updates.customerEmail = customerEmail;

        // Descuento del cupón si no se hizo
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


        // Free-order: cerramos aquí mismo
        if (isFreeOrder) {
          if (data.status === "pending" || data.status === "capturing") {
            updates.status = "reserved";
            updates.paidAt = admin.firestore.Timestamp.now();
            updates.expiresAt = admin.firestore.FieldValue.delete();
          } else {
            isAlreadyTerminal = true;
          }
          if (Object.keys(updates).length) tx.update(resRef, updates);
          return;
        }

        // Pago con PI
        if (data.status === "reserved" || data.status === "expired") {
          isAlreadyTerminal = true;
          if (Object.keys(updates).length) tx.update(resRef, updates);
          return;
        }

        // si expiró, no capturamos (y lo marcamos para cancelar PI fuera)
        const now = Date.now();
        if (data.expiresAt && typeof data.expiresAt.toDate === "function") {
          const exp = data.expiresAt.toDate();
          if (exp.getTime() <= now) {
            updates.status = "expired";
            updates.paymentRejectedReason = "expired_before_capture";
            updates.expiredAt = admin.firestore.Timestamp.now();
            expiredBeforeCapture = true; // <-- NUEVO
            if (Object.keys(updates).length) tx.update(resRef, updates);
            return;
          }
        }

        if (data.status === "pending") {
          updates.status = "capturing";
          updates.captureAttemptedAt = admin.firestore.Timestamp.now();
          if (Object.keys(updates).length) tx.update(resRef, updates);
          canCapture = true;
          return;
        }

        // Si ya estaba "capturing", podemos reintentar idempotente fuera
        if (data.status === "capturing") {
          canCapture = true;
          if (Object.keys(updates).length) tx.update(resRef, updates);
          return;
        }

        if (Object.keys(updates).length) tx.update(resRef, updates);
      });

      // Si free-order o ya terminal, no hay nada más que hacer
      if (isFreeOrder || isAlreadyTerminal) {
        return NextResponse.json({ received: true });
      }

      // Si expiró antes de capturar, cancelamos PI para liberar autorización y salimos
      if (expiredBeforeCapture) {
        await safeCancelPI(paymentIntentId, reservationId, "expired_before_capture"); // <-- NUEVO
        return NextResponse.json({ received: true });
      }

      // 2) Intentar capturar si procede
      if (canCapture && paymentIntentId) {
        try {
          const { email: receiptEmail } = await findBestReceiptEmail(stripe, session, paymentIntentId);
          if (receiptEmail) {
            try {
              await stripe.paymentIntents.update(paymentIntentId, { receipt_email: receiptEmail });
            } catch (e) {
              console.warn("Could not set receipt_email on PaymentIntent:", e);
            }
          }

          const captured = await stripe.paymentIntents.capture(
            paymentIntentId,
            {},
            { idempotencyKey: `capture_${reservationId}_${paymentIntentId}` }
          );

          // 3) Dejar reserva en 'reserved' y (AHORA SÍ) descontar cupón
          await db.runTransaction(async (tx) => {
            const s = await tx.get(resRef);
            if (!s.exists) return;
            const d: any = s.data();

            const updates: any = {
              stripePaymentIntentId: captured?.id
                ? String(captured.id)
                : (d.stripePaymentIntentId || admin.firestore.FieldValue.delete()),
            };

            // --- Descuento del cupón SOLO tras captura OK ---
            const cInfo = d?.coupon || {};
            // soporta amountApplied (euros) o amountAppliedCents (céntimos), prioriza céntimos si existe
            const amountAppliedCents = Number.isFinite(Number(cInfo.amountAppliedCents))
              ? Number(cInfo.amountAppliedCents)
              : toCents(Number(cInfo.amountApplied || 0));

            if (cInfo.id && amountAppliedCents > 0 && !cInfo.deductedAt) {
              const couponRef = db.collection("coupons").doc(String(cInfo.id));
              const cSnap = await tx.get(couponRef);
              if (cSnap.exists) {
                const cData: any = cSnap.data();
                const remainingCents = toCents(Number(cData?.remaining ?? 0));

                if (remainingCents >= amountAppliedCents) {
                  tx.update(couponRef, {
                    remaining: fromCents(remainingCents - amountAppliedCents),
                    lastUsedAt: admin.firestore.Timestamp.now(),
                  });

                  const movRef = couponRef.collection("movements").doc();
                  tx.set(movRef, {
                    type: "reservation",
                    reservationId,
                    amountCents: amountAppliedCents,
                    amount: fromCents(amountAppliedCents), // opcional, por legibilidad
                    createdAt: admin.firestore.Timestamp.now(),
                    checkoutSessionId: session.id,
                  });

                  updates.coupon = {
                    ...cInfo,
                    amountAppliedCents, // normalizamos
                    deductedAt: admin.firestore.Timestamp.now(),
                  };
                } else {
                  updates.coupon = {
                    ...cInfo,
                    amountAppliedCents,
                    deductionError: "insufficient_remaining_at_webhook",
                    deductionErrorAt: admin.firestore.Timestamp.now(),
                  };
                }
              } else {
                updates.coupon = {
                  ...cInfo,
                  amountAppliedCents,
                  deductionError: "coupon_not_found_at_webhook",
                  deductionErrorAt: admin.firestore.Timestamp.now(),
                };
              }
            }

            // --- Estado final de la reserva ---
            if (d.status !== "reserved") {
              updates.status = "reserved";
              updates.paidAt = admin.firestore.Timestamp.now();
              updates.expiresAt = admin.firestore.FieldValue.delete();
            }

            tx.update(resRef, updates);
          });

        } catch (err: any) {
          console.error("PaymentIntent capture failed (webhook):", err?.message || err);

          // si capturar falla, cancelamos para liberar autorización y marcamos expirado
          await safeCancelPI(paymentIntentId, reservationId, "capture_failed");

          await resRef.set(
            {
              status: "expired",
              paymentCaptureError: String(err?.message ?? err),
              paymentCaptureErrorAt: admin.firestore.Timestamp.now(),
            },
            { merge: true }
          );
        }
      } else if (!paymentIntentId) {
        await resRef.set(
          {
            paymentCaptureError: "missing_payment_intent_in_webhook",
            paymentCaptureErrorAt: admin.firestore.Timestamp.now(),
          },
          { merge: true }
        );
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const type = session.metadata?.type;

      if (type === "coupon") {
        const orderId = session.metadata?.orderId;
        if (orderId) {
          await db.collection("coupon_orders").doc(orderId).set(
            { status: "expired", updatedAt: admin.firestore.Timestamp.now() },
            { merge: true }
          );
        }
        return NextResponse.json({ received: true });
      }

      const reservationId = (event.data.object as any)?.metadata?.reservationId;
      if (reservationId) {
        // Marca la reserva como expirada
        await db.collection("reservations").doc(reservationId).set(
          {
            status: "expired",
            paymentRejectedReason: "checkout_session_expired",
          },
          { merge: true }
        );

        // <-- NUEVO: libera también la autorización si existe un PI
        const paymentIntentId = getSessionPaymentIntentId(session);
        await safeCancelPI(paymentIntentId, reservationId, "checkout_session_expired");
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err);
    return new Response("Webhook processing error", { status: 500 });
  }
}
