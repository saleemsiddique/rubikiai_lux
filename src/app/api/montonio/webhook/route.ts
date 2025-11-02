// app/api/montonio/webhook/route.ts
import { NextResponse } from "next/server";
import admin, { adminDb as db } from "@/lib/firebase-admin";
import { jwtVerify } from "jose";

const MONTONIO_SECRET_KEY = (process.env.MONTONIO_SECRET_KEY ?? process.env.MONTONIO_WEBHOOK_SECRET ?? "").trim();

if (!MONTONIO_SECRET_KEY) {
  console.error("MONTONIO_SECRET_KEY is not set for webhook validation.");
}

/* ---------- helpers (portadas desde el webhook de Stripe) ---------- */

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function makeCode(): string {
  const chunk = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${chunk()}-${chunk()}`;
}

/**
 * Descuenta saldo de cupón en Firestore y devuelve el bloque `coupon`
 * actualizado (con deductedAt o con error).
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

  tx.update(couponRef, {
    remaining: remaining - amountNumber,
    lastUsedAt: admin.firestore.Timestamp.now(),
  });

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
    couponAmountApplied: string;
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

  if (!alreadyUsed) {
    tx.update(percentRef, {
      used: true,
      usedAt: admin.firestore.Timestamp.now(),
      lastSentAt: pData?.lastSentAt || admin.firestore.Timestamp.now(),
    });
  }

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
  };
}

/* ---------- webhook handler ---------- */

/**
 * Webhook endpoint para recibir notificaciones de Montonio.
 * Valida orderToken (JWT) con MONTONIO_SECRET_KEY, luego actúa exactamente
 * como el webhook de Stripe: crea coupon_orders + coupons para tipo=coupon
 * y crea/mergea reservas para pagos normales, descontando cupones/porcentajes
 * dentro de transacciones.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const token = body?.orderToken || url.searchParams.get("order-token");
    if (!token) {
      console.warn("No orderToken in webhook request");
      return NextResponse.json({ error: "missing_orderToken" }, { status: 400 });
    }

    if (!MONTONIO_SECRET_KEY) {
      console.error("Missing MONTONIO_SECRET_KEY; cannot validate token.");
      return NextResponse.json({ error: "server_misconfiguration" }, { status: 500 });
    }

    const secret = new TextEncoder().encode(MONTONIO_SECRET_KEY);

    let payload: any;
    try {
      const verified = await jwtVerify(token, secret);
      payload = verified.payload;
    } catch (err) {
      console.error("Invalid orderToken signature", err);
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    console.log("📩 Montonio webhook payload:", payload);

    // Mapeos principales: merchantReference (reservationId / orderId), uuid, status
    const merchantReference: string | undefined = payload?.merchantReference || payload?.merchant_reference || payload?.merchant_reference_id || payload?.merchantRef;
    const uuid: string | undefined = payload?.uuid || payload?.order_uuid || payload?.id;
    const statusFromMontonio: string | undefined = (payload?.status || payload?.paymentStatus || payload?.state || "").toString().toLowerCase();

    // --------- CASO: pago completado (equivalente checkout.session.completed) ---------
    // Montonio puede enviar status: paid / captured / confirmed
    if (statusFromMontonio === "paid" || statusFromMontonio === "captured" || statusFromMontonio === "confirmed") {
      // verificamos si es compra de cupones: intentamos leer type desde payload.metadata o merchant metadata
      const metadata = payload?.metadata || {};
      const type = metadata?.type || payload?.type || "";

      // Si es compra de cupón -> crear coupon_orders y cupones (igual que Stripe)
      if (String(type) === "coupon") {
        const orderId = metadata?.orderId || payload?.orderId || payload?.merchantReference || merchantReference;
        if (!orderId) return NextResponse.json({ ok: true });

        const orderRef = db.collection("coupon_orders").doc(orderId);
        // Montonio no tiene session id como Stripe; guardaremos montonio uuid
        const paymentUuid = uuid || null;
        const buyerEmail = payload?.customer?.email || metadata?.buyerEmail || payload?.email || null;

        // Paso 1: asegurar que coupon_orders está en "processing"
        const result = await db.runTransaction(async (tx) => {
          const snap = await tx.get(orderRef);
          if (!snap.exists) {
            const quantity = parseInt(String(metadata?.quantity || 1), 10) || 1;
            const unitAmount = Number(metadata?.unitAmount || payload?.amount || 0) || 0;
            tx.set(orderRef, {
              status: "processing",
              unitAmount,
              unitAmountCents: Math.round(unitAmount * 100),
              quantity,
              currency: (metadata?.currency || payload?.currency || "EUR").toUpperCase(),
              createdAt: admin.firestore.Timestamp.now(),
              montonioOrderUuid: paymentUuid,
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
              : parseInt(String(metadata?.quantity || 1), 10) || 1;
            const unitAmount = Number.isFinite(Number(data.unitAmount))
              ? Number(data.unitAmount)
              : Number(metadata?.unitAmount || payload?.amount || 0) || 0;

            tx.update(orderRef, {
              status: "processing",
              montonioOrderUuid: paymentUuid,
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
              currency: (metadata?.currency || payload?.currency || "EUR").toUpperCase(),
              unitAmount,
              remaining: unitAmount,
              purchasedAt,
              expiresAt,
              montonioOrderUuid: paymentUuid || null,
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
          montonioOrderUuid: paymentUuid || null,
          buyerEmail: buyerEmail || null,
          lastWebhookAt: admin.firestore.Timestamp.now(),
        });

        await batch.commit();

        // Paso 3: email con los códigos
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
                  currency: (metadata?.currency || payload?.currency || "EUR").toUpperCase(),
                  codes: createdCodes,
                  expiresAt: expiresAt.toDate().toISOString().slice(0, 10),
                },
              }),
            });
          } catch (e: any) {
            console.error("coupon email send failed:", e?.message || e);
            await db.collection("coupon_orders").doc(orderId).update({
              emailSendErrorAt: admin.firestore.Timestamp.now(),
              emailSendError: String(e?.message ?? e),
            });
          }
        }

        return NextResponse.json({ received: true });
      }

      // ----------------- RESERVA NORMAL (pago Montonio -> tratamos como checkout.session.completed) -----------------

      const reservationId = merchantReference || metadata?.reservationId || payload?.reservationId;
      if (!reservationId) {
        // no hay reserva asociada
        return NextResponse.json({ ok: true });
      }

      const resRef = db.collection("reservations").doc(reservationId);

      // Intentamos leer la metadata que usamos en create-checkout-session (se puede enviar por merchantReference metadata)
      const meta = metadata || {};

      const rawValue = meta?.rawValue || payload?.rawValue || "";
      const houseIdsCsv = meta?.houseIds || payload?.houseIds || "";
      const houseIds = String(houseIdsCsv)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const checkIn = meta?.checkIn || payload?.checkIn || "";
      const checkOut = meta?.checkOut || payload?.checkOut || "";
      const nights = Number(meta?.nights ?? payload?.nights ?? 0);

      const guestsNum = Number(meta?.guests ?? payload?.guests ?? 0);
      const includedBase = Number(meta?.includedBase ?? payload?.includedBase ?? 0);
      const extraGuests = Number(meta?.extraGuests ?? payload?.extraGuests ?? 0);

      const totalNightsOnly = Number(meta?.totalNightsOnly ?? payload?.totalNightsOnly ?? 0);
      const firstNightCharge = Number(meta?.firstNightCharge ?? payload?.firstNightCharge ?? 0);
      const discountedFirst = Number(meta?.discountedFirst ?? payload?.discountedFirst ?? 0);

      const jacuzziEnabled = (meta?.jacuzziEnabled ?? payload?.jacuzziEnabled) === "true" || meta?.jacuzziEnabled === true || payload?.jacuzziEnabled === true;
      const jacuzziFee = Number(meta?.jacuzziFee ?? payload?.jacuzziFee ?? 0);

      const grandTotal = Number(meta?.grandTotal ?? payload?.grandTotal ?? payload?.amount ?? 0);
      const discountedGrandTotal = Number(meta?.discountedGrandTotal ?? payload?.discountedGrandTotal ?? 0);
      const currency = (meta?.currency || payload?.currency || "EUR").toUpperCase();

      const discountKind = meta?.discountKind || payload?.discountKind || ""; // "coupon" | "percent" | ""
      const couponId = meta?.couponId || payload?.couponId || "";
      const couponCode = meta?.couponCode || payload?.couponCode || "";
      const percentId = meta?.percentId || payload?.percentId || "";
      const percentCode = meta?.percentCode || payload?.percentCode || "";
      const percentValue = meta?.percentValue || payload?.percentValue || "";
      const couponAmountApplied = meta?.couponAmountApplied || payload?.couponAmountApplied || "";

      const app_user_id = meta?.app_user_id || payload?.app_user_id || "";

      const customerEmailFromMeta = meta?.customerEmail || payload?.customerEmail || "";
      const customerNameFromMeta = meta?.customerName || payload?.customerName || "";
      const customerPhoneFromMeta = meta?.customerPhone || payload?.customerPhone || "";
      const arrivalTime = meta?.arrivalTime || payload?.arrivalTime || "";
      const comment = meta?.comment || payload?.comment || "";

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

          montonioOrderUuid: uuid || null,

          customerEmail:
            customerEmailFromMeta || null,

          customer: {
            email: customerEmailFromMeta || null,
            name: customerNameFromMeta || null,
            phone: customerPhoneFromMeta || null,
            arrivalTime: arrivalTime || null,
            comment: comment || null,
            userId: app_user_id || null,
          },
        };

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
            checkoutSessionId: uuid || "montonio",
          });
          baseReservationPayload.coupon = couponBlock;
        } else if (
          discountKind === "percent" &&
          percentId
        ) {
          const percentBlock = await applyPercentDiscountInTx(tx, {
            percentId,
            percentCode,
            percentValue,
            couponAmountApplied,
            reservationId,
            checkoutSessionId: uuid || "montonio",
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

    // --------- CASO: checkout.session.expired (equivalente) ---------
    // status can be expired / cancelled / failed
    if (statusFromMontonio === "expired" || statusFromMontonio === "cancelled" || statusFromMontonio === "failed") {
      // Si viene merchantReference -> cancelamos reserva y la marcamos canceled
      const reservationId = merchantReference || payload?.reservationId;
      if (reservationId) {
        const resRef = db.collection("reservations").doc(reservationId);
        await resRef.set(
          {
            status: "canceled",
            paymentRejectedReason: `montonio_${statusFromMontonio}`,
            canceledAt: admin.firestore.Timestamp.now(),
            montonioNotification: payload,
            montonioStatus: statusFromMontonio,
            montonioOrderUuid: uuid || admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      return NextResponse.json({ received: true });
    }

    // Si no coincide ningún caso, simplemente guardamos la notificación en la reserva si existe
    if (merchantReference) {
      const docRef = db.collection("reservations").doc(merchantReference);
      const snap = await docRef.get();
      if (snap.exists) {
        await docRef.update({
          montonioNotification: payload,
          montonioStatus: statusFromMontonio ?? null,
          montonioOrderUuid: uuid ?? admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error processing Montonio webhook:", err);
    return NextResponse.json({ error: err?.message || "internal_error" }, { status: 500 });
  }
}
