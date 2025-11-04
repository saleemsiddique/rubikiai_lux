// app/api/montonio/webhook/route.ts
import { NextResponse } from "next/server";
import admin, { adminDb as db } from "@/lib/firebase-admin";
import { jwtVerify } from "jose";

const MONTONIO_SECRET_KEY = (
  process.env.MONTONIO_SECRET_KEY ??
  process.env.MONTONIO_WEBHOOK_SECRET ??
  ""
).trim();

if (!MONTONIO_SECRET_KEY) {
  console.error("MONTONIO_SECRET_KEY is not set for webhook validation.");
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
 */
async function applyPercentDiscountInTx(
  tx: FirebaseFirestore.Transaction,
  {
    percentId,
    percentCode,
    percentValue,
    percentAmountApplied, // <-- cambiar de couponAmountApplied
    reservationId,
    checkoutSessionId,
  }: {
    percentId: string;
    percentCode: string;
    percentValue: string;
    percentAmountApplied: string; // <-- nuevo nombre
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

  // ESTRUCTURA IGUAL QUE COUPON:
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

function firstNonEmpty(...objs: any[]) {
  for (const o of objs) {
    if (o && typeof o === "object" && Object.keys(o).length > 0) return o;
  }
  return {};
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const rawText = await req.text().catch(() => "");
    let bodyParsed: any = {};
    try {
      if (rawText && rawText.trim().length > 0) {
        bodyParsed = JSON.parse(rawText);
      }
    } catch (e) {
      bodyParsed = {};
    }

    const tokenFromQuery =
      url.searchParams.get("order-token") ||
      url.searchParams.get("orderToken") ||
      null;
    const tokenFromBodyCandidates =
      bodyParsed?.orderToken ||
      bodyParsed?.order?.orderToken ||
      bodyParsed?.data ||
      bodyParsed?.token ||
      bodyParsed?.order?.token ||
      bodyParsed?.payload ||
      null;

    let token: string | null =
      tokenFromQuery || tokenFromBodyCandidates || null;

    if (!token && typeof bodyParsed?.data === "object") {
      token =
        bodyParsed.data?.orderToken ||
        bodyParsed.data?.token ||
        bodyParsed.data?.data ||
        null;
    }

    if (
      !token &&
      typeof rawText === "string" &&
      rawText.split(".").length === 3
    ) {
      token = rawText.trim();
    }

    if (!token) {
      console.warn(
        "No orderToken found in webhook request (tried query/body/raw). rawText length:",
        (rawText || "").length
      );
      console.log("Raw headers:", Object.fromEntries(req.headers.entries()));
      console.log("Raw body preview:", (rawText || "").slice(0, 1000));
      return NextResponse.json(
        { error: "missing_orderToken" },
        { status: 400 }
      );
    }

    if (!MONTONIO_SECRET_KEY) {
      console.error("Missing MONTONIO_SECRET_KEY; cannot validate token.");
      return NextResponse.json(
        { error: "server_misconfiguration" },
        { status: 500 }
      );
    }

    const secret = new TextEncoder().encode(MONTONIO_SECRET_KEY);

    // DEBUG: print minimal info at start
    console.log("---- Montonio webhook: headers ----");
    console.log(Object.fromEntries(req.headers.entries()));
    const rawText1 = await req.text().catch(() => "");
    console.log(
      "---- Montonio webhook: raw body length ----",
      rawText1?.length
    );
    console.log(
      "---- Montonio webhook: raw body preview ----",
      (rawText1 || "").slice(0, 1000)
    );

    let payload: any;
    try {
      const verified = await jwtVerify(token, secret);
      payload = verified.payload;
    } catch (err) {
      console.error("Invalid orderToken signature", err);
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    console.log(
      "📩 Montonio webhook payload completo:",
      JSON.stringify(payload, null, 2)
    );

    const merchantReference: string | undefined =
      payload?.merchantReference ||
      payload?.merchant_reference ||
      payload?.merchant_reference_id ||
      payload?.merchantRef ||
      payload?.orderReference ||
      payload?.merchant_reference_id;

    const uuid: string | undefined =
      payload?.uuid || payload?.order_uuid || payload?.id || payload?.order?.id;
    const statusFromMontonio: string | undefined = (
      payload?.status ||
      payload?.paymentStatus ||
      payload?.state ||
      ""
    )
      .toString()
      .toLowerCase();

    console.log("🔍 merchantReference:", merchantReference);
    console.log("🔍 uuid:", uuid);
    console.log("🔍 status:", statusFromMontonio);

    const metadataCandidate: any =
      firstNonEmpty(
        payload?.metadata,
        payload?.data?.metadata,
        payload?.order?.metadata,
        payload?.order?.data?.metadata,
        payload?.attributes?.metadata,
        payload?.meta,
        payload?.data,
        payload?.order
      ) || {};

    console.log(
      "➡️ metadataCandidate keys:",
      Object.keys(metadataCandidate || {})
    );

    async function buildMetaWithFallback(reservationId?: string) {
      let meta: any =
        metadataCandidate && Object.keys(metadataCandidate || {}).length > 0
          ? { ...metadataCandidate }
          : {};

      if ((!meta || Object.keys(meta).length === 0) && reservationId) {
        try {
          const intentSnap = await db
            .collection("checkout_intents")
            .doc(reservationId)
            .get();
          if (intentSnap.exists) {
            const intent = intentSnap.data() || {};
            console.log("ℹ️ Found checkout_intent fallback for", reservationId);

            // start from intent.metadata if present, otherwise from explicit fields
            const fromIntentMeta =
              intent.metadata && typeof intent.metadata === "object"
                ? { ...intent.metadata }
                : {};

            meta = {
              ...fromIntentMeta,
              // legacy / top-level intent fields (if not in metadata)
              checkIn: fromIntentMeta.checkIn ?? intent.checkIn,
              checkOut: fromIntentMeta.checkOut ?? intent.checkOut,
              nights: fromIntentMeta.nights ?? intent.nights,
              guests: fromIntentMeta.guests ?? intent.guests,
              includedBase: fromIntentMeta.includedBase ?? intent.includedBase,
              extraGuests: fromIntentMeta.extraGuests ?? intent.extraGuests,
              totalNightsOnly:
                fromIntentMeta.totalNightsOnly ?? intent.totalNightsOnly,
              firstNightCharge:
                fromIntentMeta.firstNightCharge ?? intent.firstNightCharge,
              discountedFirst:
                fromIntentMeta.discountedFirst ?? intent.discountedFirst,
              jacuzziEnabled:
                fromIntentMeta.jacuzziEnabled ??
                intent.jacuzziEnabled ??
                intent.jacuzzi?.enabled ??
                false,
              jacuzziFee:
                fromIntentMeta.jacuzziFee ??
                intent.jacuzziFee ??
                intent.jacuzzi?.fee ??
                0,
              // NUEVO
              jacuzziDays:
                fromIntentMeta.jacuzziDays ??
                intent.jacuzziDays ??
                intent.jacuzzi?.days ??
                0,
              grandTotal: fromIntentMeta.grandTotal ?? intent.grandTotal,
              discountedGrandTotal:
                fromIntentMeta.discountedGrandTotal ??
                intent.discountedGrandTotal,
              currency: fromIntentMeta.currency ?? intent.currency,
              customerEmail:
                fromIntentMeta.customerEmail ??
                (intent.customer?.email || intent.customerEmail),
              customerName:
                fromIntentMeta.customerName ?? (intent.customer?.name || ""),
              customerPhone:
                fromIntentMeta.customerPhone ?? (intent.customer?.phone || ""),
              arrivalTime:
                fromIntentMeta.arrivalTime ??
                (intent.customer?.arrivalTime || ""),
              comment:
                fromIntentMeta.comment ?? (intent.customer?.comment || ""),
              houseIds: fromIntentMeta.houseIds ?? intent.houseIds,
              app_user_id:
                fromIntentMeta.app_user_id ??
                (intent.customer?.userId || intent.app_user_id),
              // include coupon/percent fields if present in metadata
              discountKind:
                fromIntentMeta.discountKind ??
                intent.metadata?.discountKind ??
                "",
              couponId:
                fromIntentMeta.couponId ?? intent.metadata?.couponId ?? "",
              couponCode:
                fromIntentMeta.couponCode ?? intent.metadata?.couponCode ?? "",
              couponAmountApplied:
                fromIntentMeta.couponAmountApplied ??
                intent.metadata?.couponAmountApplied ??
                "",
              percentId:
                fromIntentMeta.percentId ?? intent.metadata?.percentId ?? "",
              percentCode:
                fromIntentMeta.percentCode ??
                intent.metadata?.percentCode ??
                "",
              percentValue:
                fromIntentMeta.percentValue ??
                intent.metadata?.percentValue ??
                "",
              percentAmountApplied:
                fromIntentMeta.percentAmountApplied ??
                intent.metadata?.percentAmountApplied ??
                "",
              rawValue:
                fromIntentMeta.rawValue ?? intent.metadata?.rawValue ?? "",
            };
          } else {
            const resSnap = await db
              .collection("reservations")
              .doc(reservationId)
              .get();
            if (resSnap.exists) {
              const existing = resSnap.data() || {};
              console.log(
                "ℹ️ Found existing reservation doc fallback for",
                reservationId
              );

              // if existing has metadata (from checkout), prefer that for coupon fields
              const existingMeta =
                existing.metadata && typeof existing.metadata === "object"
                  ? { ...existing.metadata }
                  : {};

              meta = {
                checkIn: existingMeta.checkIn ?? existing.checkIn,
                checkOut: existingMeta.checkOut ?? existing.checkOut,
                nights: existingMeta.nights ?? existing.nights,
                guests: existingMeta.guests ?? existing.guests,
                includedBase:
                  existingMeta.includedBase ?? existing.includedBase,
                extraGuests: existingMeta.extraGuests ?? existing.extraGuests,
                totalNightsOnly:
                  existingMeta.totalNightsOnly ?? existing.totalNightsOnly,
                firstNightCharge:
                  existingMeta.firstNightCharge ?? existing.firstNightCharge,
                discountedFirst:
                  existingMeta.discountedFirst ?? existing.discountedFirst,
                jacuzziEnabled:
                  existingMeta.jacuzziEnabled ??
                  existing.jacuzzi?.enabled ??
                  false,
                jacuzziFee: existingMeta.jacuzziFee ?? existing.jacuzziFee ?? 0,
                // NUEVO
                jacuzziDays:
                  existingMeta.jacuzziDays ?? existing.jacuzzi?.days ?? 0,
                grandTotal: existingMeta.grandTotal ?? existing.grandTotal,
                discountedGrandTotal:
                  existingMeta.discountedGrandTotal ??
                  existing.discountedGrandTotal,
                currency: existingMeta.currency ?? existing.currency,
                customerEmail:
                  existingMeta.customerEmail ??
                  existing.customerEmail ??
                  existing?.customer?.email,
                customerName:
                  existingMeta.customerName ?? existing?.customer?.name,
                customerPhone:
                  existingMeta.customerPhone ?? existing?.customer?.phone,
                arrivalTime:
                  existingMeta.arrivalTime ?? existing?.customer?.arrivalTime,
                comment: existingMeta.comment ?? existing?.customer?.comment,
                houseIds: existingMeta.houseIds ?? existing.houseIds,
                app_user_id:
                  existingMeta.app_user_id ??
                  existing?.customer?.userId ??
                  existing.app_user_id,
                // coupon/percent fields
                discountKind:
                  existingMeta.discountKind ?? existing.discountKind ?? "",
                couponId:
                  existingMeta.couponId ??
                  existing.coupon?.id ??
                  existing.couponId ??
                  "",
                couponCode:
                  existingMeta.couponCode ??
                  existing.coupon?.code ??
                  existing.couponCode ??
                  "",
                couponAmountApplied:
                  existingMeta.couponAmountApplied ??
                  existing.coupon?.amountApplied ??
                  existing.couponAmountApplied ??
                  "",
                percentId:
                  existingMeta.percentId ??
                  existing.percentDiscount?.id ??
                  existing.percentId ??
                  "",
                percentCode:
                  existingMeta.percentCode ??
                  existing.percentDiscount?.code ??
                  existing.percentCode ??
                  "",
                percentValue:
                  existingMeta.percentValue ??
                  existing.percentDiscount?.percent ??
                  existing.percentValue ??
                  "",
                rawValue: existingMeta.rawValue ?? existing.rawValue ?? "",
              };
            } else {
              console.log(
                "ℹ️ No checkout_intent or reservation doc found for fallback:",
                reservationId
              );
            }
          }
        } catch (e) {
          console.error("Error while fetching fallback intent/reservation:", e);
        }
      }

      return meta || {};
    }

    // ---------- PROCESS "PAID / CAPTURED / CONFIRMED" ----------
    if (
      statusFromMontonio === "paid" ||
      statusFromMontonio === "captured" ||
      statusFromMontonio === "confirmed"
    ) {
      let type = String(
        metadataCandidate?.type || payload?.type || ""
      ).toLowerCase();
      // fallback: if there is an existing coupon_orders doc with merchantReference/orderId, treat it as coupon
      const possibleOrderId =
        metadataCandidate?.orderId ||
        payload?.orderId ||
        payload?.merchantReference ||
        merchantReference;
      if (!type && possibleOrderId) {
        const orderSnap = await db
          .collection("coupon_orders")
          .doc(String(possibleOrderId))
          .get();
        if (orderSnap.exists) {
          console.log(
            "Webhook fallback: found coupon_orders doc for",
            possibleOrderId,
            "— treating as coupon."
          );
          type = "coupon";
        }
      }

      // coupon purchase (coupon orders)
      if (String(type) === "coupon") {
        const orderId =
          metadataCandidate?.orderId ||
          payload?.orderId ||
          payload?.merchantReference ||
          merchantReference;
        if (!orderId) return NextResponse.json({ ok: true });

        const orderRef = db.collection("coupon_orders").doc(orderId);
        const paymentUuid = uuid || null;
        const buyerEmail =
          payload?.customer?.email ||
          metadataCandidate?.buyerEmail ||
          payload?.email ||
          null;

        const result = await db.runTransaction(async (tx) => {
          const snap = await tx.get(orderRef);
          if (!snap.exists) {
            const quantity =
              parseInt(String(metadataCandidate?.quantity || 1), 10) || 1;
            const unitAmount =
              Number(metadataCandidate?.unitAmount || payload?.amount || 0) ||
              0;
            tx.set(orderRef, {
              status: "processing",
              unitAmount,
              unitAmountCents: Math.round(unitAmount * 100),
              quantity,
              currency: (
                metadataCandidate?.currency ||
                payload?.currency ||
                "EUR"
              ).toUpperCase(),
              createdAt: admin.firestore.Timestamp.now(),
              montonioOrderUuid: paymentUuid,
              buyerEmail: buyerEmail || null,
            });
            return {
              quantity,
              unitAmount,
              alreadyCompleted: false,
              buyerEmail: buyerEmail || null,
            };
          } else {
            const data: any = snap.data();
            if (data.status === "completed") {
              return {
                quantity: Number(data.quantity || 1),
                unitAmount: Number(data.unitAmount || 0),
                alreadyCompleted: true,
                buyerEmail: data.buyerEmail || null,
              };
            }
            const quantity = Number.isFinite(Number(data.quantity))
              ? Number(data.quantity)
              : parseInt(String(metadataCandidate?.quantity || 1), 10) || 1;
            const unitAmount = Number.isFinite(Number(data.unitAmount))
              ? Number(data.unitAmount)
              : Number(metadataCandidate?.unitAmount || payload?.amount || 0) ||
                0;
            // Preferir el buyerEmail ya almacenado en el doc si existe, si no usar el que venía en payload/metadata
            const effectiveBuyerEmail = data.buyerEmail || buyerEmail || null;
            tx.update(orderRef, {
              status: "processing",
              montonioOrderUuid: paymentUuid,
              buyerEmail: effectiveBuyerEmail,
              unitAmount,
              quantity,
            });
            return {
              quantity,
              unitAmount,
              alreadyCompleted: false,
              buyerEmail: effectiveBuyerEmail,
            };
          }
        });

        if (result.alreadyCompleted)
          return NextResponse.json({ received: true });

        const purchasedAt = admin.firestore.Timestamp.now();
        const expiresAt = admin.firestore.Timestamp.fromDate(
          addMonths(new Date(), 12)
        );
        const quantity = result.quantity;
        const unitAmount = result.unitAmount;
        const buyerEmailFinal = result.buyerEmail || null; // <-- usar este valor garantizado

        const batch = db.batch();
        const createdCodes: Array<{ code: string; remaining: number }> = [];

        for (let i = 0; i < quantity; i++) {
          const cDocId = `${orderId}_${i}`;
          const cRef = db.collection("coupons").doc(cDocId);
          const cSnap = await cRef.get();
          if (!cSnap.exists) {
            const code = makeCode();
            batch.set(cRef, {
              buyerEmail: buyerEmailFinal,
              code,
              createdByWebhook: true,
              currency: (
                metadataCandidate?.currency ||
                payload?.currency ||
                "EUR"
              ).toUpperCase(),
              expiresAt,
              orderId,
              purchasedAt,
              remaining: unitAmount,
              status: "active",
              montonioOrderUuid: paymentUuid || null,
              unitAmount,
              unitAmountCents: Math.round(unitAmount * 100),
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

        // cuando actualices el order doc, también puedes asegurar buyerEmail allí
        batch.update(orderRef, {
          status: "completed",
          completedAt: admin.firestore.Timestamp.now(),
          lastWebhookAt: admin.firestore.Timestamp.now(),
          montonioOrderUuid: paymentUuid || null,
          buyerEmail: buyerEmailFinal,
          unitAmount,
          unitAmountCents: Math.round(unitAmount * 100),
          quantity,
          currency: (
            metadataCandidate?.currency ||
            payload?.currency ||
            "EUR"
          ).toUpperCase(),
          montonioPaymentUrl:
            payload?.paymentUrl ||
            payload?.payment_url ||
            payload?.order?.payment_url ||
            null,
        });

        await batch.commit();

        // send email with codes (if buyerEmail present)
        if (buyerEmailFinal) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                type: "coupon_purchase",
                to: buyerEmailFinal,
                data: {
                  unitAmount,
                  quantity,
                  currency: (
                    metadataCandidate?.currency ||
                    payload?.currency ||
                    "EUR"
                  ).toUpperCase(),
                  codes: createdCodes,
                  expiresAt: expiresAt.toDate().toISOString().slice(0, 10),
                },
              }),
            });
          } catch (e: any) {
            console.error("coupon email send failed:", e?.message || e);
            await db
              .collection("coupon_orders")
              .doc(orderId)
              .update({
                emailSendErrorAt: admin.firestore.Timestamp.now(),
                emailSendError: String(e?.message ?? e),
              });
          }
        }

        return NextResponse.json({ received: true });
      }

      // ----------------- RESERVA NORMAL -----------------
      // Aquí mantenemos TODA la lógica de reservas que tenías antes:
      // 1) extraer reservationId desde metadata/merchantReference
      // 2) construir meta con buildMetaWithFallback(...)
      // 3) crear/mergear reserva dentro de una transaction y aplicar coupons/percents
      // 4) marcar checkout_intent consumido
      const reservationId =
        merchantReference ||
        metadataCandidate?.reservationId ||
        payload?.reservationId;
      if (!reservationId) {
        console.log("⚠️ No se encontró reservationId en el payload");
        return NextResponse.json({ ok: true });
      }

      console.log("✅ Procesando reserva:", reservationId);

      const resRef = db.collection("reservations").doc(reservationId);

      // build meta with fallback to checkout_intent/reservation doc
      const meta = await buildMetaWithFallback(reservationId);

      console.log(
        "📋 Extrayendo datos de metadata final (meta):",
        JSON.stringify(meta, null, 2)
      );

      const houseIdsCsv = meta?.houseIds || "";
      const houseIds = String(houseIdsCsv)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const checkIn = meta?.checkIn || "";
      const checkOut = meta?.checkOut || "";
      const nights = Number(meta?.nights ?? 0);

      const guestsNum = Number(meta?.guests ?? 0);
      const includedBase = Number(meta?.includedBase ?? 2);
      const extraGuests = Number(meta?.extraGuests ?? 0);

      const totalNightsOnly = Number(meta?.totalNightsOnly ?? 0);
      const firstNightCharge = Number(meta?.firstNightCharge ?? 0);
      const discountedFirst = Number(meta?.discountedFirst ?? 0);

      // Después de extraer jacuzziFee:
      const jacuzziEnabled =
        meta?.jacuzziEnabled === "true" || meta?.jacuzziEnabled === true;
      const jacuzziFee = Number(meta?.jacuzziFee ?? 0);
      const jacuzziDays = Number(meta?.jacuzziDays ?? 0); // NUEVO

      const grandTotal = Number(meta?.grandTotal ?? 0);
      const discountedGrandTotal = Number(meta?.discountedGrandTotal ?? 0);
      const currency = (meta?.currency || "EUR").toUpperCase();

      const discountKind = meta?.discountKind || "";
      const couponId = meta?.couponId || "";
      const couponCode = meta?.couponCode || "";
      const percentId = meta?.percentId || "";
      const percentCode = meta?.percentCode || "";
      const percentValue = meta?.percentValue || "";
      const couponAmountApplied = meta?.couponAmountApplied || "";

      const app_user_id = meta?.app_user_id || "";

      const customerEmailFromMeta = meta?.customerEmail || "";
      const customerNameFromMeta = meta?.customerName || "";
      const customerPhoneFromMeta = meta?.customerPhone || "";
      const arrivalTime = meta?.arrivalTime || "";
      const comment = meta?.comment || "";

      const montonioOrderUuid = uuid || null;
      const montonioNotification = payload;

      // Transaction: create/update reservation and apply discounts (coupons/percent) atomically
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(resRef);
        const existsAlready = snap.exists;
        const nowTs = admin.firestore.Timestamp.now();

        console.log("💾 Guardando reserva - existe?:", existsAlready);

        const payNow = Number(meta?.payNow ?? discountedFirst ?? 0);
        const totalStay = Number(meta?.totalStay ?? discountedGrandTotal ?? 0);
        const payAtArrival = Number(
          meta?.payAtArrival ?? Math.max(0, totalStay - payNow)
        );

        const baseReservationPayload: any = {
          houseId: houseIds.length === 1 ? houseIds[0] : houseIds.join("__"),
          houseIds,
          checkIn,
          checkOut,
          nights,
          guests: guestsNum,

          // CAMPOS SIMPLIFICADOS
          payNow,
          payAtArrival,
          totalStay,

          // campos legacy (opcional, por compatibilidad):
          includedBase,
          extraGuests,
          totalNightsOnly,
          firstNightCharge,

          jacuzzi: jacuzziEnabled
            ? { enabled: true, fee: jacuzziFee, days: jacuzziDays } // AÑADIR days
            : { enabled: false, fee: 0, days: 0 },
          jacuzziFee,

          currency,
          status: "reserved",
          createdAt: existsAlready ? snap.data()?.createdAt || nowTs : nowTs,
          paidAt: nowTs,
          montonioOrderUuid: montonioOrderUuid,
          montonioNotification,
          customerEmail: customerEmailFromMeta || null,
          customer: {
            email: customerEmailFromMeta || null,
            name: customerNameFromMeta || null,
            phone: customerPhoneFromMeta || null,
            arrivalTime: arrivalTime || null,
            comment: comment || null,
            userId: app_user_id || null,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // APPLY COUPON OR PERCENT within same transaction
        if (
          discountKind === "coupon" &&
          couponId &&
          Number(couponAmountApplied) > 0
        ) {
          console.log("💳 Aplicando cupón (webhook):", couponId);
          const couponBlock = await applyCouponInTx(tx, {
            couponId,
            couponCode,
            couponAmountApplied,
            reservationId,
            checkoutSessionId: montonioOrderUuid || "montonio",
          });
          baseReservationPayload.coupon = couponBlock;

          if (
            !couponBlock.deductionError &&
            Number(couponBlock.amountApplied) > 0
          ) {
            const applied = Number(couponBlock.amountApplied || 0);
            baseReservationPayload.discountedFirst = Math.max(
              0,
              (baseReservationPayload.discountedFirst || discountedFirst) -
                applied
            );
            baseReservationPayload.discountedGrandTotal = Math.max(
              0,
              (baseReservationPayload.discountedGrandTotal ||
                discountedGrandTotal) - applied
            );
          }
        } else if (discountKind === "percent" && percentId) {
          console.log(
            "📊 Aplicando descuento porcentual (webhook):",
            percentId
          );

          const percentAmountApplied =
            meta?.percentAmountApplied || couponAmountApplied || ""; // fallback

          const percentBlock = await applyPercentDiscountInTx(tx, {
            percentId,
            percentCode,
            percentValue,
            percentAmountApplied, // <-- usar el nuevo campo
            reservationId,
            checkoutSessionId: montonioOrderUuid || "montonio",
          });

          baseReservationPayload.percentDiscount = percentBlock;

          if (
            !percentBlock.deductionError &&
            Number(percentBlock.amountApplied) > 0
          ) {
            const applied = Number(percentBlock.amountApplied || 0);
            baseReservationPayload.discountedFirst = Math.max(
              0,
              (baseReservationPayload.discountedFirst || discountedFirst) -
                applied
            );
            baseReservationPayload.discountedGrandTotal = Math.max(
              0,
              (baseReservationPayload.discountedGrandTotal ||
                discountedGrandTotal) - applied
            );
          }
        }

        if (!existsAlready) {
          console.log("✨ Creando nueva reserva (webhook)");
          tx.set(resRef, baseReservationPayload);
        } else {
          console.log("🔄 Actualizando reserva existente (webhook)");
          tx.update(resRef, baseReservationPayload);
        }
      });

      // After successful transaction: cleanup checkout_intent (mark consumed)
      try {
        const intentRef = db.collection("checkout_intents").doc(reservationId);
        const intentSnap = await intentRef.get();
        if (intentSnap.exists) {
          await intentRef.update({
            consumed: true,
            consumedAt: admin.firestore.Timestamp.now(),
            montonioOrderUuid: montonioOrderUuid || null,
            lastWebhookAt: admin.firestore.Timestamp.now(),
          });
          console.log("🧹 checkout_intent marked consumed for", reservationId);
        }
      } catch (e) {
        console.warn("Could not mark checkout_intent as consumed:", e);
      }

      // --- AÑADIR BLOQUE: enviar email de confirmación (usar la plantilla EN) ---
      try {
        const customerEmail = customerEmailFromMeta || null;
        if (customerEmail) {
          // Usar los campos simplificados que ya calculamos
          const paidNow = Number(meta?.payNow ?? discountedFirst ?? 0);
          const totalStayAmount = Number(
            meta?.totalStay ?? discountedGrandTotal ?? 0
          );
          const payAtArrivalAmount = Number(
            meta?.payAtArrival ?? Math.max(0, totalStayAmount - paidNow)
          );

          // Descuento aplicado (si hay cupón o porcentaje)
          let discountApplied = 0;
          if (discountKind === "coupon" && couponAmountApplied) {
            discountApplied = Number(couponAmountApplied) || 0;
          } else if (discountKind === "percent" && meta?.percentAmountApplied) {
            discountApplied = Number(meta.percentAmountApplied) || 0;
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
                    : meta?.roomType || houseIds.join(", ")) || "Accommodation",
                guests: guestsNum,
                // NUEVOS CAMPOS SIMPLIFICADOS:
                paidNow,
                payAtArrival: payAtArrivalAmount,
                totalStay: totalStayAmount,
                discountApplied, // lo que se descontó del cupón/porcentaje
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
                await db
                  .collection("reservations")
                  .doc(reservationId)
                  .update({
                    emailSendErrorAt: admin.firestore.Timestamp.now(),
                    emailSendError: `status_${res.status}`,
                    lastEmailResponse: text,
                  });
              } else {
                await db.collection("reservations").doc(reservationId).update({
                  confirmationEmailSentAt: admin.firestore.Timestamp.now(),
                });
              }
            })
            .catch(async (e) => {
              console.error("Reservation confirmation email send error:", e);
              await db
                .collection("reservations")
                .doc(reservationId)
                .update({
                  emailSendErrorAt: admin.firestore.Timestamp.now(),
                  emailSendError: String(e?.message ?? e),
                });
            });
        } else {
          console.log(
            "No customer email available — skipping reservation confirmation email."
          );
        }
      } catch (e) {
        console.error(
          "Unexpected error when sending reservation confirmation email:",
          e
        );
      }
      // --- FIN BLOQUE ---

      console.log("✅ Reserva procesada exitosamente:", reservationId);
      return NextResponse.json({ received: true });
    }

    // failed/cancelled/expired
    if (
      statusFromMontonio === "expired" ||
      statusFromMontonio === "cancelled" ||
      statusFromMontonio === "failed"
    ) {
      console.log("❌ Pago fallido/cancelado:", statusFromMontonio);
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

    // default: attach notification to reservation if exists
    console.log("⚠️ Status desconocido:", statusFromMontonio);

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
    console.error("❌ Error processing Montonio webhook:", err);
    return NextResponse.json(
      { error: err?.message || "internal_error" },
      { status: 500 }
    );
  }
}
