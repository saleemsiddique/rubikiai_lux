// app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import admin, { adminDb } from "@/lib/firebase-admin"; // <-- usa la ruta correcta según tu proyecto
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ?? ""
).trim();

// ya no hace falta volver a inicializar aquí, lo hace lib/firebase-admin.ts
const db = adminDb;

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
 * Coupon: resta saldo y crea movimiento. Debe llamarse DENTRO de una transaction.
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
    return {
      id: couponId,
      code: couponCode,
      amountApplied: amountNumber,
      deductionError: "invalid_amount_at_webhook",
      deductionErrorAt: admin.firestore.Timestamp.now(),
    };
  }

  if (remaining < amountNumber) {
    return {
      id: couponId,
      code: couponCode,
      amountApplied: amountNumber,
      deductionError: "insufficient_remaining_at_webhook",
      deductionErrorAt: admin.firestore.Timestamp.now(),
    };
  }

  // restar saldo
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

  const now = admin.firestore.Timestamp.now();
  return {
    id: couponId,
    code: couponCode,
    amountApplied: amountNumber,
    deductedAt: now,
    createdAt: now,
    checkoutSessionId,
  };
}

/**
 * Percent discount: marca used=true y registra movimiento.
 * Debe llamarse DENTRO de una transaction.
 * ✅ ESTRUCTURA IGUAL QUE COUPON
 */
async function applyPercentDiscountInTx(
  tx: FirebaseFirestore.Transaction,
  {
    percentId,
    percentCode,
    percentValue,
    percentAmountApplied,
    reservationId,
    checkoutSessionId,
  }: {
    percentId: string;
    percentCode: string;
    percentValue: string;
    percentAmountApplied: string;
    reservationId: string;
    checkoutSessionId: string;
  }
) {
  const percentRef = db
    .collection("percentage_discounts")
    .doc(String(percentId));
  const pSnap = await tx.get(percentRef);

  if (!pSnap.exists) {
    return {
      id: percentId,
      code: percentCode,
      percent: Number(percentValue),
      amountApplied: Number(percentAmountApplied) || 0,
      deductionError: "percent_not_found_at_webhook",
      deductionErrorAt: admin.firestore.Timestamp.now(),
    };
  }

  const pData: any = pSnap.data();

  tx.update(percentRef, {
    used: true,
    usedAt: admin.firestore.Timestamp.now(),
    lastSentAt: pData?.lastSentAt || admin.firestore.Timestamp.now(),
  });

  const movRef = percentRef.collection("movements").doc();
  tx.set(movRef, {
    type: "reservation",
    reservationId,
    amountApplied: Number(percentAmountApplied) || 0,
    percentValue: Number(percentValue) || 0,
    createdAt: admin.firestore.Timestamp.now(),
    checkoutSessionId,
  });

  const now = admin.firestore.Timestamp.now();

  // ✅ ESTRUCTURA IGUAL QUE COUPON
  return {
    id: percentId,
    code: percentCode,
    percent: Number(percentValue) || 0,
    amountApplied: Number(percentAmountApplied) || 0,
    deductedAt: now,
    createdAt: now,
    checkoutSessionId,
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
        // --- LÓGICA CUPONES (mantener igual) ---
        const orderId = session.metadata?.orderId;
        if (!orderId) return NextResponse.json({ ok: true });

        const orderRef = db.collection("coupon_orders").doc(orderId);
        const paymentIntentId = getSessionPaymentIntentId(session);
        const buyerEmail =
          session.customer_details?.email || session.customer_email || null;

        const result = await db.runTransaction(async (tx) => {
          const snap = await tx.get(orderRef);
          if (!snap.exists) {
            const quantity =
              parseInt(String(session.metadata?.quantity || "1"), 10) || 1;
            const unitAmount = Number(session.metadata?.unitAmount || 0) || 0;
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
              : parseInt(String(session.metadata?.quantity || "1"), 10) || 1;
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
              remaining: Number(cData.remaining ?? unitAmount),
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

        // Notify owner about coupon purchase
        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              type: "owner_coupon_notification",
              to: OWNER_EMAIL, // <- sustituir por email real
              data: {
                orderId,
                buyerEmail: buyerEmail || null,
                unitAmount,
                quantity,
                currency: "EUR",
                totalAmount: unitAmount * quantity,
                codes: createdCodes,
                expiresAt: expiresAt.toDate().toISOString().slice(0, 10),
                purchasedAt: purchasedAt.toDate().toISOString(),
              },
            }),
          });
        } catch (e) {
          console.error("owner coupon email failed:", e);
        }

        return NextResponse.json({ received: true });
      }

      // ----------------- RESERVA NORMAL -----------------

      const reservationId = session.metadata?.reservationId;
      if (!reservationId) {
        return NextResponse.json({ ok: true });
      }

      const resRef = db.collection("reservations").doc(reservationId);

      // Datos principales desde metadata
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

      // ✅ LEER CAMPOS SIMPLIFICADOS (NUEVOS)
      const payNow = Number(session.metadata?.payNow ?? 0);
      const payAtArrival = Number(session.metadata?.payAtArrival ?? 0);
      const totalStay = Number(session.metadata?.totalStay ?? 0);

      // campos legacy (para compatibilidad / fallback)
      const totalNightsOnly = Number(session.metadata?.totalNightsOnly || 0);
      const firstNightCharge = Number(session.metadata?.firstNightCharge || 0);

      const jacuzziEnabled = session.metadata?.jacuzziEnabled === "true";
      const jacuzziFee = Number(session.metadata?.jacuzziFee || 0);
      const jacuzziDays = Number(session.metadata?.jacuzziDays || 0); // ✅ NUEVO

      const currency = session.metadata?.currency || "EUR";

      const discountKind = session.metadata?.discountKind || "";
      const couponId = session.metadata?.couponId || "";
      const couponCode = session.metadata?.couponCode || "";
      const couponAmountApplied = session.metadata?.couponAmountApplied || "";

      const percentId = session.metadata?.percentId || "";
      const percentCode = session.metadata?.percentCode || "";
      const percentValue = session.metadata?.percentValue || "";
      const percentAmountApplied = session.metadata?.percentAmountApplied || "";

      const app_user_id = session.metadata?.app_user_id || "";

      const customerEmailFromMeta = session.metadata?.customerEmail || "";
      const customerNameFromMeta = session.metadata?.customerName || "";
      const customerPhoneFromMeta = session.metadata?.customerPhone || "";
      const arrivalTime = session.metadata?.arrivalTime || "";
      const comment = session.metadata?.comment || "";

      const stripePaymentIntentId = getSessionPaymentIntentId(session);
      const stripeCustomerId =
        typeof session.customer === "string" ? session.customer : null;
      const stripeCheckoutEmail =
        session.customer_details?.email || session.customer_email || null;

      // ✅ Crear/mergear reserva con campos simplificados
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(resRef);
        const existsAlready = snap.exists;
        const nowTs = admin.firestore.Timestamp.now();

        const baseReservationPayload: any = {
          houseId: houseIds.length === 1 ? houseIds[0] : houseIds.join("__"),
          houseIds,
          checkIn,
          checkOut,
          nights,
          guests: guestsNum,

          // ✅ CAMPOS SIMPLIFICADOS (NUEVOS)
          payNow,
          payAtArrival,
          totalStay,

          // campos legacy (mantener para compatibilidad)
          includedBase,
          extraGuests,
          totalNightsOnly,
          firstNightCharge,

          jacuzzi: jacuzziEnabled
            ? { enabled: true, fee: jacuzziFee, days: jacuzziDays } // ✅ AÑADIDO days
            : { enabled: false, fee: 0, days: 0 },
          jacuzziFee,

          currency,

          status: "reserved",
          createdAt: existsAlready ? snap.data()?.createdAt || nowTs : nowTs,
          paidAt: nowTs,

          stripeSessionId: session.id,
          stripePaymentIntentId: stripePaymentIntentId || null,
          stripeCustomerId: stripeCustomerId || null,

          customerEmail: stripeCheckoutEmail || customerEmailFromMeta || null,

          customer: {
            email: stripeCheckoutEmail || customerEmailFromMeta || null,
            name: customerNameFromMeta || null,
            phone: customerPhoneFromMeta || null,
            arrivalTime: arrivalTime || null,
            comment: comment || null,
            userId: app_user_id || null,
          },
        };

        // ✅ APLICAR DESCUENTOS (coupon o percent)
        if (
          discountKind === "coupon" &&
          couponId &&
          Number(couponAmountApplied) > 0
        ) {
          const couponBlock = await applyCouponInTx(tx, {
            couponId,
            couponCode,
            couponAmountApplied,
            reservationId,
            checkoutSessionId: session.id,
          });
          baseReservationPayload.coupon = couponBlock;
        } else if (discountKind === "percent" && percentId) {
          const percentBlock = await applyPercentDiscountInTx(tx, {
            percentId,
            percentCode,
            percentValue,
            percentAmountApplied,
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

      // ✅ Enviar email de confirmación
      try {
        const customerEmail =
          stripeCheckoutEmail || customerEmailFromMeta || null;
        if (customerEmail) {
          // Calcular descuento aplicado (si hay cupón o porcentaje)
          let discountApplied = 0;
          if (discountKind === "coupon" && couponAmountApplied) {
            discountApplied = Number(couponAmountApplied) || 0;
          } else if (discountKind === "percent" && percentAmountApplied) {
            discountApplied = Number(percentAmountApplied) || 0;
          }

          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              type: "reservation_confirmation",
              to: customerEmail,
              lang: "en",
              data: {
                reservationId,
                guestName: customerNameFromMeta || customerEmail,
                bookingDate: new Date().toISOString().slice(0, 19),
                checkIn,
                checkOut,
                nights,
                roomType:
                  (houseIds.length === 1
                    ? houseIds[0]
                    : rawValue || houseIds.join(", ")) || "Accommodation",
                guests: guestsNum,
                // ✅ NUEVOS CAMPOS SIMPLIFICADOS:
                paidNow: payNow,
                payAtArrival: payAtArrival,
                totalStay: totalStay,
                discountApplied: discountApplied,
                currency,
                hotelName: "Rubikiai Lux",
                hotelContactEmail: "info@rubikiailux.lt",
                hotelContactPhone: "",
              },
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const text = await res.text().catch(() => "");
                console.error(
                  "Reservation confirmation email send failed:",
                  res.status,
                  text
                );
                await resRef.update({
                  emailSendErrorAt: admin.firestore.Timestamp.now(),
                  emailSendError: `status_${res.status}`,
                  lastEmailResponse: text,
                });
              } else {
                await resRef.update({
                  confirmationEmailSentAt: admin.firestore.Timestamp.now(),
                });
              }
            })
            .catch(async (e) => {
              console.error("Reservation confirmation email send error:", e);
              await resRef.update({
                emailSendErrorAt: admin.firestore.Timestamp.now(),
                emailSendError: String(e?.message ?? e),
              });
            });
        }
      } catch (e) {
        console.error(
          "Unexpected error when sending reservation confirmation email:",
          e
        );
      }

      // after sending customer confirmation...
      try {
        // Notify owner
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "owner_reservation_notification",
            to: OWNER_EMAIL, // <- sustituye por owner/email dinámico si lo tienes
            data: {
              reservationId,
              guestName: customerNameFromMeta || stripeCheckoutEmail || "Guest",
              guestEmail: stripeCheckoutEmail || customerEmailFromMeta || null,
              guestPhone: customerPhoneFromMeta || null,
              bookingDate: new Date().toISOString().slice(0, 19),
              checkIn,
              checkOut,
              nights,
              roomType:
                (houseIds.length === 1 ? houseIds[0] : rawValue) ||
                "Accommodation",
              guests: guestsNum,
              paidNow: payNow,
              payAtArrival: payAtArrival,
              totalStay: totalStay,
              discountApplied:
                discountKind === "coupon"
                  ? Number(couponAmountApplied || 0)
                  : discountKind === "percent"
                    ? Number(percentAmountApplied || 0)
                    : 0,
              currency,
              propertyName: rawValue || houseIds.join(", "),
              propertyId: houseIds.length === 1 ? houseIds[0] : undefined,
              paymentMethod: stripePaymentIntentId ? "card" : "checkout", // mejora: mapea con session.payment_method_types
              merchantReference: session.id || reservationId,
              notes: comment || "",
            },
          }),
        });
      } catch (e) {
        console.error("owner reservation email failed:", e);
      }

      // ✅ Enviar email recordatorio si check-in <= 7 días
      try {
        const customerEmail = customerEmailFromMeta || stripeCheckoutEmail || null; // <- añadir stripeCheckoutEmail en Stripe
        if (customerEmail && checkIn) {
          const now = new Date();
          const checkInDate = new Date(checkIn);
          const daysUntilCheckIn = Math.ceil(
            (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          console.log(`📅 Check-in: ${checkIn}, Días hasta check-in: ${daysUntilCheckIn}`);

          if (daysUntilCheckIn <= 7 && daysUntilCheckIn >= 0) {
            console.log(`📧 Enviando recordatorio (${daysUntilCheckIn} días)`);

            // Determinar qué versión del email usar según houseId
            const firstHouseId = houseIds.length > 0 ? houseIds[0] : "";
            const reminderVariant = firstHouseId === "L0TeFf2LmrWGAaAyS8NY" ? "A" : "B";

            const reminderPayload = {
              type: "booking_reminder",
              to: customerEmail,
              lang: "en",
              data: {
                guestName: customerNameFromMeta || customerEmail.split("@")[0],
                houseName: houseIds.length === 1 ? houseIds[0] : (houseIds.join(", ") || "Rubikiai Lux"),
                checkIn,
                checkOut: checkOut || undefined,
                nGuests: guestsNum || 2,
                variant: reminderVariant,
                notes: comment || undefined,
              },
            };

            console.log("📤 Payload del reminder:", JSON.stringify(reminderPayload, null, 2));

            const reminderRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(reminderPayload),
            });

            if (reminderRes.ok) {
              console.log("✅ Email recordatorio enviado");
              await resRef.update({
                reminderEmailSentAt: admin.firestore.Timestamp.now(),
              });
            } else {
              const errorText = await reminderRes.text().catch(() => "");
              console.error("❌ Error enviando recordatorio:", reminderRes.status, errorText);
              await resRef.update({
                reminderEmailErrorAt: admin.firestore.Timestamp.now(),
                reminderEmailError: `status_${reminderRes.status}: ${errorText}`,
              });
            }
          } else {
            console.log(`ℹ️ Check-in en ${daysUntilCheckIn} días - no enviar recordatorio`);
          }
        } else {
          console.log("⚠️ No hay email o checkIn para enviar recordatorio");
        }
      } catch (e) {
        console.error("❌ Error en booking reminder:", e);
      }

      return NextResponse.json({ received: true });
    }

    // ======================================================
    // ================ CHECKOUT EXPIRED ====================
    // ======================================================
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const type = session.metadata?.type;

      if (type === "coupon") {
        const orderId = session.metadata?.orderId;
        if (orderId) {
          await db.collection("coupon_orders").doc(orderId).set(
            {
              status: "expired",
              updatedAt: admin.firestore.Timestamp.now(),
            },
            { merge: true }
          );
        }
        return NextResponse.json({ received: true });
      }

      const reservationId = session.metadata?.reservationId;
      if (reservationId) {
        const resRef = db.collection("reservations").doc(reservationId);

        await resRef.set(
          {
            status: "canceled",
            paymentRejectedReason: "checkout_session_expired",
            canceledAt: admin.firestore.Timestamp.now(),
          },
          { merge: true }
        );

        const paymentIntentId = getSessionPaymentIntentId(session);
        await safeCancelPI(
          paymentIntentId,
          reservationId,
          "checkout_session_expired"
        );
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err);
    return new Response("Webhook processing error", { status: 500 });
  }
}
