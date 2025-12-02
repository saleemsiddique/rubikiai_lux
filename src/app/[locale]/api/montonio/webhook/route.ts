// app/api/montonio/webhook/route.ts
import { NextResponse } from "next/server";
import admin, { adminDb as db } from "@/lib/firebase-admin";
import { jwtVerify } from "jose";
import { nowInLithuania } from "@/app/[locale]/utils/date-server";
import { getHouseDisplayName } from "@/lib/houseNames";

const MONTONIO_SECRET_KEY = (
  process.env.MONTONIO_SECRET_KEY ??
  process.env.MONTONIO_WEBHOOK_SECRET ??
  ""
).trim();

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ?? ""
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
      deductionErrorAt: nowInLithuania(),
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
      deductionErrorAt: nowInLithuania(),
    };
  }

  if (remaining < amountNumber) {
    return {
      id: couponId,
      code: couponCode,
      amountApplied: amountNumber,
      deductionError: "insufficient_remaining_at_webhook",
      deductionErrorAt: nowInLithuania(),
    };
  }

  // restar saldo
  tx.update(couponRef, {
    remaining: remaining - amountNumber,
    lastUsedAt: nowInLithuania(),
  });

  // registrar movimiento
  const movRef = couponRef.collection("movements").doc();
  tx.set(movRef, {
    type: "reservation",
    reservationId,
    amount: amountNumber,
    createdAt: nowInLithuania(),
    checkoutSessionId,
  });

  const now = nowInLithuania();
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
      deductionErrorAt: nowInLithuania(),
    };
  }

  const pData: any = pSnap.data();

  tx.update(percentRef, {
    used: true,
    usedAt: nowInLithuania(),
    lastSentAt: pData?.lastSentAt || nowInLithuania(),
  });

  const movRef = percentRef.collection("movements").doc();
  tx.set(movRef, {
    type: "reservation",
    reservationId,
    amountApplied: Number(percentAmountApplied) || 0,
    percentValue: Number(percentValue) || 0,
    createdAt: nowInLithuania(),
    checkoutSessionId,
  });

  const now = nowInLithuania();

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
              locale: fromIntentMeta.locale ?? intent.locale ?? "lt",
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
                locale: existingMeta.locale ?? existing.locale ?? "lt",
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
              createdAt: nowInLithuania(),
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

        const purchasedAt = nowInLithuania();
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
          completedAt: nowInLithuania(),
          lastWebhookAt: nowInLithuania(),
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

        // Extract locale from metadata (defaults to 'lt')
        const couponLocale = metadataCandidate?.locale || "lt";

        // send email with codes (if buyerEmail present)
        if (buyerEmailFinal) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/${couponLocale}/api/send-email`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                type: "coupon_purchase",
                to: buyerEmailFinal,
                locale: couponLocale,
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
                emailSendErrorAt: nowInLithuania(),
                emailSendError: String(e?.message ?? e),
              });
          }
        }

        // --- NOTIFY OWNER (USING OWNER_EMAIL ENV) ---
        try {
          if (OWNER_EMAIL) {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/${couponLocale}/api/send-email`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                type: "owner_coupon_notification",
                to: OWNER_EMAIL,
                locale: couponLocale,
                data: {
                  orderId: orderId,
                  buyerEmail: buyerEmailFinal,
                  unitAmount,
                  quantity,
                  currency: (
                    metadataCandidate?.currency ||
                    payload?.currency ||
                    "EUR"
                  ).toUpperCase(),
                  totalAmount: (unitAmount || 0) * (quantity || 0),
                  codes: createdCodes,
                  expiresAt: expiresAt.toDate().toISOString().slice(0, 10),
                  purchasedAt: purchasedAt.toDate().toISOString(),
                  paymentMethod: payload?.paymentMethod || payload?.payment_type || null,
                },
              }),
            });

            // marca ownerNotified en el order doc
            try {
              await db.collection("coupon_orders").doc(orderId).update({
                ownerNotifiedAt: nowInLithuania(),
                ownerNotifiedEmail: OWNER_EMAIL,
              });
            } catch (e) {
              console.warn("Could not mark coupon_orders ownerNotified:", e);
            }
          } else {
            console.log("OWNER_EMAIL not set — skipping owner coupon notification.");
          }
        } catch (e) {
          console.error("owner coupon email failed:", e);
          try {
            await db.collection("coupon_orders").doc(orderId).update({
              ownerEmailNotifyErrorAt: nowInLithuania(),
              ownerEmailNotifyError: String((e as any)?.message || e),
            });
          } catch { }
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

      // ✅ LEER CAMPOS BASE (SIN DESCUENTO)
      const totalNightsOnly = Number(meta?.totalNightsOnly ?? 0);
      const firstNightBase = Number(meta?.firstNightCharge ?? 0);
      const jacuzziFee = Number(meta?.jacuzziFee ?? 0);
      const jacuzziDays = Number(meta?.jacuzziDays ?? 0);
      const extrasTotal = Number(meta?.extrasTotal || jacuzziFee);
      const grandTotalBase = Number(meta?.grandTotal ?? (totalNightsOnly + extrasTotal));

      const jacuzziEnabled =
        meta?.jacuzziEnabled === "true" || meta?.jacuzziEnabled === true;
      const currency = (meta?.currency || "EUR").toUpperCase();

      const discountKind = meta?.discountKind || "";
      const couponId = meta?.couponId || "";
      const couponCode = meta?.couponCode || "";
      const couponValue = Number(meta?.couponValue || meta?.couponAmountApplied || 0);

      const percentId = meta?.percentId || "";
      const percentCode = meta?.percentCode || "";
      const percentValue = Number(meta?.percentValue || 0);

      const app_user_id = meta?.app_user_id || "";

      const customerEmailFromMeta = meta?.customerEmail || "";
      const customerNameFromMeta = meta?.customerName || "";
      const customerPhoneFromMeta = meta?.customerPhone || "";
      const arrivalTime = meta?.arrivalTime || "";
      const comment = meta?.comment || "";
      const localeFromMeta = meta?.locale || "lt";

      const montonioOrderUuid = uuid || null;
      const montonioNotification = payload;

      // ✅ APLICAR DESCUENTO (MISMA LÓGICA QUE ADMIN/BLOCK)
      let discountedFirst = firstNightBase;
      let discountedGrandTotal = grandTotalBase;
      let amountApplied = 0;
      let couponData: any = null;
      let percentData: any = null;

      if (discountKind === "coupon" && couponId && couponValue > 0) {
        // Coupon: fixed euro amount off total
        amountApplied = Math.min(couponValue, grandTotalBase);
        const usedOnFirstNight = Math.min(amountApplied, firstNightBase);
        discountedFirst = Math.max(0, firstNightBase - usedOnFirstNight);
        discountedGrandTotal = Math.max(0, grandTotalBase - amountApplied);

        couponData = {
          code: couponCode,
          type: "coupon",
          value: couponValue,
          applied: amountApplied,
        };
      } else if (discountKind === "percent" && percentId && percentValue > 0) {
        // Percentage: applies only to first night
        const percentVal = Math.min(100, Math.max(0, percentValue));
        const discountOnFirstNight = (percentVal / 100) * firstNightBase;

        amountApplied = discountOnFirstNight;
        discountedFirst = Math.max(0, firstNightBase - discountOnFirstNight);
        discountedGrandTotal = Math.max(0, grandTotalBase - discountOnFirstNight);

        percentData = {
          code: percentCode,
          type: "percent",
          percent: percentVal,
          applied: amountApplied,
        };
      }

      // ✅ CALCULAR CAMPOS SIMPLIFICADOS
      const payNow = discountedFirst; // Reservation fee (con descuento)
      const totalStay = discountedGrandTotal; // Grand total (con descuento)
      const payAtArrival = Math.max(0, totalStay - payNow);

      // ✅ CALCULAR amountPaid (lo que el cliente pagó)
      const amountPaid = payNow;
      const isPaidInFull = amountPaid >= grandTotalBase;

      // Transaction: create/update reservation and apply discounts (coupons/percent) atomically
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(resRef);
        const existsAlready = snap.exists;
        const nowTs = nowInLithuania();

        console.log("💾 Guardando reserva - existe?:", existsAlready);

        const baseReservationPayload: any = {
          houseId: houseIds.length === 1 ? houseIds[0] : houseIds.join("__"),
          houseIds,
          checkIn,
          checkOut,
          nights,
          guests: guestsNum,

          // ✅ CAMPOS SIMPLIFICADOS (RECALCULADOS)
          payNow,
          payAtArrival,
          totalStay,

          // ✅ CAMPOS DETALLADOS (para transparencia)
          firstNightBase,
          totalNightsOnly,
          grandTotal: grandTotalBase,
          discountedFirst,
          discountedGrandTotal,
          amountApplied,
          extrasTotal,

          amountPaid,
          paidInFull: isPaidInFull,

          // campos legacy (mantener para compatibilidad)
          includedBase,
          extraGuests,

          jacuzzi: jacuzziEnabled
            ? { enabled: true, fee: jacuzziFee, days: jacuzziDays }
            : { enabled: false, fee: 0, days: 0 },
          jacuzziFee,
          jacuzziDays,

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
          updatedAt: nowInLithuania(),
        };

        // ✅ APLICAR DESCUENTOS (coupon o percent) - con valores recalculados
        if (discountKind === "coupon" && couponId && amountApplied > 0) {
          console.log("💳 Aplicando cupón (webhook):", couponId);
          const couponBlock = await applyCouponInTx(tx, {
            couponId,
            couponCode,
            couponAmountApplied: String(amountApplied),
            reservationId,
            checkoutSessionId: montonioOrderUuid || "montonio",
          });
          baseReservationPayload.coupon = couponBlock;
          baseReservationPayload.code = couponCode;
        } else if (discountKind === "percent" && percentId && amountApplied > 0) {
          console.log("📊 Aplicando descuento porcentual (webhook):", percentId);
          const percentBlock = await applyPercentDiscountInTx(tx, {
            percentId,
            percentCode,
            percentValue: String(percentValue),
            percentAmountApplied: String(amountApplied),
            reservationId,
            checkoutSessionId: montonioOrderUuid || "montonio",
          });
          baseReservationPayload.percentDiscount = percentBlock;
          baseReservationPayload.code = percentCode;
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
            consumedAt: nowInLithuania(),
            montonioOrderUuid: montonioOrderUuid || null,
            lastWebhookAt: nowInLithuania(),
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
          console.log(`📧 Montonio webhook: sending confirmation email in locale: ${localeFromMeta}`);

          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/${localeFromMeta}/api/send-email`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              type: "reservation_confirmation",
              to: customerEmail,
              locale: localeFromMeta,
              data: {
                reservationId,
                guestName: customerNameFromMeta || customerEmail,
                bookingDate: new Date().toISOString().slice(0, 19),
                checkIn,
                checkOut,
                nights,
                roomType: getHouseDisplayName(houseIds),
                guests: guestsNum,
                // ✅ CAMPOS RECALCULADOS:
                paidNow: payNow,
                payAtArrival: payAtArrival,
                totalStay: totalStay,
                discountApplied: amountApplied,
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
                    emailSendErrorAt: nowInLithuania(),
                    emailSendError: `status_${res.status}`,
                    lastEmailResponse: text,
                  });
              } else {
                await db.collection("reservations").doc(reservationId).update({
                  confirmationEmailSentAt: nowInLithuania(),
                });
              }
            })
            .catch(async (e) => {
              console.error("Reservation confirmation email send error:", e);
              await db
                .collection("reservations")
                .doc(reservationId)
                .update({
                  emailSendErrorAt: nowInLithuania(),
                  emailSendError: String(e?.message ?? e),
                });
            });
          // ⏱️ ESPERAR 600ms antes del siguiente email
          await new Promise(resolve => setTimeout(resolve, 600));
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

      // --- NOTIFY OWNER (USING OWNER_EMAIL ENV) ---
      try {
        if (OWNER_EMAIL) {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/${localeFromMeta}/api/send-email`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              type: "owner_reservation_notification",
              to: OWNER_EMAIL,
              locale: localeFromMeta,
              data: {
                reservationId,
                guestName: customerNameFromMeta || customerEmailFromMeta || "Guest",
                guestEmail: customerEmailFromMeta || null,
                guestPhone: customerPhoneFromMeta || null,
                bookingDate: new Date().toISOString().slice(0, 19),
                checkIn,
                checkOut,
                nights,
                roomType: getHouseDisplayName(houseIds),
                guests: guestsNum,
                paidNow: payNow,
                payAtArrival: payAtArrival,
                totalStay: totalStay,
                discountApplied: amountApplied,
                currency,
                propertyName: meta?.rawValue || (houseIds.length === 1 ? houseIds[0] : undefined),
                propertyId: houseIds.length === 1 ? houseIds[0] : undefined,
                paymentMethod: montonioOrderUuid ? "montonio" : null,
                merchantReference: uuid || merchantReference || null,
                notes: meta?.comment || "",
              },
            }),
          });

          // marca ownerNotified en la reserva
          try {
            await db.collection("reservations").doc(reservationId).update({
              ownerNotifiedAt: nowInLithuania(),
              ownerNotifiedEmail: OWNER_EMAIL,
            });
          } catch (e) {
            console.warn("Could not mark reservation ownerNotified:", e);
          }
          // ⏱️ ESPERAR 600ms antes del siguiente email
          await new Promise(resolve => setTimeout(resolve, 600));
        } else {
          console.log("OWNER_EMAIL not set — skipping owner reservation notification.");
        }
      } catch (e) {
        console.error("owner reservation notification failed:", e);
        try {
          await db.collection("reservations").doc(reservationId).update({
            ownerNotifyErrorAt: nowInLithuania(),
            ownerNotifyError: String((e as any)?.message || e),
          });
        } catch { }
      }

      // --- FIN BLOQUE ---

      // ✅ Enviar email recordatorio si check-in <= 7 días (Montonio)
      try {
        const customerEmail = customerEmailFromMeta || null;
        if (customerEmail && checkIn) {
          const now = new Date();
          const checkInDate = new Date(checkIn);
          const daysUntilCheckIn = Math.ceil(
            (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysUntilCheckIn <= 7 && daysUntilCheckIn >= 0) {
            console.log(`📧 Check-in en ${daysUntilCheckIn} días - enviando recordatorio`);

            // Determinar qué versión del email usar según houseId
            const firstHouseId = houseIds.length > 0 ? houseIds[0] : "";
            const reminderVariant =
              firstHouseId === "L0TeFf2LmrWGAaAyS8NY" ? "A" : "B";

            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/${localeFromMeta}/api/send-email`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                type: "booking_reminder",
                to: customerEmail,
                locale: localeFromMeta,
                data: {
                  guestName: customerNameFromMeta || customerEmail.split("@")[0],
                  houseName: getHouseDisplayName(houseIds),
                  checkIn,
                  checkOut,
                  nGuests: guestsNum,
                  variant: reminderVariant,
                  notes: comment || undefined,
                },
              }),
            })
              .then(async (res) => {
                if (res.ok) {
                  console.log("✅ Email recordatorio enviado");
                  await db.collection("reservations").doc(reservationId).update({
                    reminderEmailSentAt: nowInLithuania(),
                  });
                } else {
                  console.error("❌ Error enviando recordatorio:", res.status);
                }
              })
              .catch((e) => {
                console.error("❌ Booking reminder email error:", e);
              });
          } else {
            console.log(`ℹ️ Check-in en ${daysUntilCheckIn} días - no enviar recordatorio aún`);
          }
        }
      } catch (e) {
        console.error("Error checking/sending booking reminder (Montonio):", e);
      }

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
            canceledAt: nowInLithuania(),
            montonioNotification: payload,
            montonioStatus: statusFromMontonio,
            montonioOrderUuid: uuid || admin.firestore.FieldValue.delete(),
            updatedAt: nowInLithuania(),
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
          updatedAt: nowInLithuania(),
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
