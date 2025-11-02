// app/api/montonio/webhook/route.ts
import { NextResponse } from "next/server";
import admin, { adminDb as db } from "@/lib/firebase-admin";
import { jwtVerify } from "jose";

const MONTONIO_SECRET_KEY = (process.env.MONTONIO_SECRET_KEY ?? process.env.MONTONIO_WEBHOOK_SECRET ?? "").trim();

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

function firstNonEmpty(...objs: any[]) {
  for (const o of objs) {
    if (o && typeof o === "object" && Object.keys(o).length > 0) return o;
  }
  return {};
}

export async function POST(req: Request) {
  try {
    // read raw body first (some webhooks send raw jwt or nested structure)
    const url = new URL(req.url);
    const rawText = await req.text().catch(() => "");
    let bodyParsed: any = {};
    try {
      if (rawText && rawText.trim().length > 0) {
        bodyParsed = JSON.parse(rawText);
      }
    } catch (e) {
      // not JSON — maybe raw JWT or other format
      bodyParsed = {};
    }

    // robust token extraction (query param, common body shapes, raw jwt)
    const tokenFromQuery = url.searchParams.get("order-token") || url.searchParams.get("orderToken") || null;
    const tokenFromBodyCandidates =
      bodyParsed?.orderToken ||
      bodyParsed?.order?.orderToken ||
      bodyParsed?.data ||
      bodyParsed?.token ||
      bodyParsed?.order?.token ||
      bodyParsed?.payload ||
      null;

    let token: string | null = tokenFromQuery || tokenFromBodyCandidates || null;

    // if bodyParsed.data is an object that contains the token as "data" or "orderToken"
    if (!token && typeof bodyParsed?.data === "object") {
      token = bodyParsed.data?.orderToken || bodyParsed.data?.token || bodyParsed.data?.data || null;
    }

    // if still nothing, maybe the raw body is directly the JWT
    if (!token && typeof rawText === "string" && rawText.split(".").length === 3) {
      token = rawText.trim();
    }

    if (!token) {
      console.warn("No orderToken found in webhook request (tried query/body/raw). rawText length:", (rawText || "").length);
      console.log("Raw headers:", Object.fromEntries(req.headers.entries()));
      console.log("Raw body preview:", (rawText || "").slice(0, 1000));
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

    console.log("📩 Montonio webhook payload completo:", JSON.stringify(payload, null, 2));

    const merchantReference: string | undefined =
      payload?.merchantReference ||
      payload?.merchant_reference ||
      payload?.merchant_reference_id ||
      payload?.merchantRef ||
      payload?.orderReference ||
      payload?.merchant_reference_id;

    const uuid: string | undefined = payload?.uuid || payload?.order_uuid || payload?.id || payload?.order?.id;
    const statusFromMontonio: string | undefined = (payload?.status || payload?.paymentStatus || payload?.state || "").toString().toLowerCase();

    console.log("🔍 merchantReference:", merchantReference);
    console.log("🔍 uuid:", uuid);
    console.log("🔍 status:", statusFromMontonio);

    // robust metadata extraction: try many places montonio might use
    const metadataCandidate: any = firstNonEmpty(
      payload?.metadata,
      payload?.data?.metadata,
      payload?.order?.metadata,
      payload?.order?.data?.metadata,
      payload?.attributes?.metadata,
      payload?.meta,
      payload?.data,
      payload?.order
    ) || {};

    console.log("➡️ metadataCandidate keys:", Object.keys(metadataCandidate || {}));

    // Helper to load checkout_intent fallback and reservation fallback if metadata empty
    async function buildMetaWithFallback(reservationId?: string) {
      let meta: any = metadataCandidate && Object.keys(metadataCandidate || {}).length > 0 ? metadataCandidate : {};
      if ((!meta || Object.keys(meta).length === 0) && reservationId) {
        // try checkout_intents collection (lightweight persisted intent from checkout)
        try {
          const intentSnap = await db.collection("checkout_intents").doc(reservationId).get();
          if (intentSnap.exists) {
            const intent = intentSnap.data() || {};
            console.log("ℹ️ Found checkout_intent fallback for", reservationId);
            meta = {
              checkIn: intent.checkIn,
              checkOut: intent.checkOut,
              nights: intent.nights,
              guests: intent.guests,
              includedBase: intent.includedBase,
              extraGuests: intent.extraGuests,
              totalNightsOnly: intent.totalNightsOnly,
              firstNightCharge: intent.firstNightCharge,
              discountedFirst: intent.discountedFirst,
              jacuzziEnabled: intent.jacuzziEnabled ?? (intent.jacuzzi?.enabled ?? false),
              jacuzziFee: intent.jacuzziFee ?? intent.jacuzzi?.fee ?? 0,
              grandTotal: intent.grandTotal,
              discountedGrandTotal: intent.discountedGrandTotal,
              currency: intent.currency,
              customerEmail: intent.customer?.email || intent.customerEmail,
              customerName: intent.customer?.name || "",
              customerPhone: intent.customer?.phone || "",
              arrivalTime: intent.customer?.arrivalTime || "",
              comment: intent.customer?.comment || "",
              houseIds: intent.houseIds,
              app_user_id: intent.customer?.userId || intent.app_user_id,
              // include any other safe fields you trust from intent
            };
          } else {
            // as last fallback, maybe a reservation doc exists (e.g., free-order flow or manual create)
            const resSnap = await db.collection("reservations").doc(reservationId).get();
            if (resSnap.exists) {
              const existing = resSnap.data() || {};
              console.log("ℹ️ Found existing reservation doc fallback for", reservationId);
              meta = {
                checkIn: existing.checkIn,
                checkOut: existing.checkOut,
                nights: existing.nights,
                guests: existing.guests,
                includedBase: existing.includedBase,
                extraGuests: existing.extraGuests,
                totalNightsOnly: existing.totalNightsOnly,
                firstNightCharge: existing.firstNightCharge,
                discountedFirst: existing.discountedFirst,
                jacuzziEnabled: existing.jacuzzi?.enabled,
                jacuzziFee: existing.jacuzziFee,
                grandTotal: existing.grandTotal,
                discountedGrandTotal: existing.discountedGrandTotal,
                currency: existing.currency,
                customerEmail: existing.customerEmail || existing?.customer?.email,
                customerName: existing?.customer?.name,
                customerPhone: existing?.customer?.phone,
                arrivalTime: existing?.customer?.arrivalTime,
                comment: existing?.customer?.comment,
                houseIds: existing.houseIds,
                app_user_id: existing?.customer?.userId || existing.app_user_id,
              };
            } else {
              console.log("ℹ️ No checkout_intent or reservation doc found for fallback:", reservationId);
            }
          }
        } catch (e) {
          console.error("Error while fetching fallback intent/reservation:", e);
        }
      }

      return meta || {};
    }

    // ---------- PROCESS "PAID / CAPTURED / CONFIRMED" ----------
    if (statusFromMontonio === "paid" || statusFromMontonio === "captured" || statusFromMontonio === "confirmed") {
      const type = metadataCandidate?.type || payload?.type || "";

      // coupon flow
      if (String(type) === "coupon") {
        const orderId = metadataCandidate?.orderId || payload?.orderId || payload?.merchantReference || merchantReference;
        if (!orderId) return NextResponse.json({ ok: true });

        const orderRef = db.collection("coupon_orders").doc(orderId);
        const paymentUuid = uuid || null;
        const buyerEmail = payload?.customer?.email || metadataCandidate?.buyerEmail || payload?.email || null;

        const result = await db.runTransaction(async (tx) => {
          const snap = await tx.get(orderRef);
          if (!snap.exists) {
            const quantity = parseInt(String(metadataCandidate?.quantity || 1), 10) || 1;
            const unitAmount = Number(metadataCandidate?.unitAmount || payload?.amount || 0) || 0;
            tx.set(orderRef, {
              status: "processing",
              unitAmount,
              unitAmountCents: Math.round(unitAmount * 100),
              quantity,
              currency: (metadataCandidate?.currency || payload?.currency || "EUR").toUpperCase(),
              createdAt: admin.firestore.Timestamp.now(),
              montonioOrderUuid: paymentUuid,
              buyerEmail: buyerEmail || null,
            });
            return { quantity, unitAmount, alreadyCompleted: false };
          } else {
            const data: any = snap.data();
            if (data.status === "completed") {
              return { quantity: Number(data.quantity || 1), unitAmount: Number(data.unitAmount || 0), alreadyCompleted: true };
            }
            const quantity = Number.isFinite(Number(data.quantity)) ? Number(data.quantity) : parseInt(String(metadataCandidate?.quantity || 1), 10) || 1;
            const unitAmount = Number.isFinite(Number(data.unitAmount)) ? Number(data.unitAmount) : Number(metadataCandidate?.unitAmount || payload?.amount || 0) || 0;
            tx.update(orderRef, { status: "processing", montonioOrderUuid: paymentUuid, buyerEmail: data.buyerEmail || buyerEmail || null, unitAmount, quantity });
            return { quantity, unitAmount, alreadyCompleted: false };
          }
        });

        if (result.alreadyCompleted) return NextResponse.json({ received: true });

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
              currency: (metadataCandidate?.currency || payload?.currency || "EUR").toUpperCase(),
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
            createdCodes.push({ code: String(cData.code), remaining: Number(cData.remaining ?? unitAmount) });
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
                  currency: (metadataCandidate?.currency || payload?.currency || "EUR").toUpperCase(),
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

      // Reserva normal: try to construct meta with fallbacks
      const reservationId = merchantReference || metadataCandidate?.reservationId || payload?.reservationId;
      if (!reservationId) {
        console.log("⚠️ No se encontró reservationId en el payload");
        return NextResponse.json({ ok: true });
      }

      console.log("✅ Procesando reserva:", reservationId);

      const resRef = db.collection("reservations").doc(reservationId);

      // build meta with fallback to checkout_intent/reservation doc
      const meta = await buildMetaWithFallback(reservationId);

      console.log("📋 Extrayendo datos de metadata final (meta):", JSON.stringify(meta, null, 2));

      const houseIdsCsv = meta?.houseIds || "";
      const houseIds = String(houseIdsCsv).split(",").map((s) => s.trim()).filter(Boolean);

      const checkIn = meta?.checkIn || "";
      const checkOut = meta?.checkOut || "";
      const nights = Number(meta?.nights ?? 0);

      const guestsNum = Number(meta?.guests ?? 0);
      const includedBase = Number(meta?.includedBase ?? 2);
      const extraGuests = Number(meta?.extraGuests ?? 0);

      const totalNightsOnly = Number(meta?.totalNightsOnly ?? 0);
      const firstNightCharge = Number(meta?.firstNightCharge ?? 0);
      const discountedFirst = Number(meta?.discountedFirst ?? 0);

      const jacuzziEnabled = meta?.jacuzziEnabled === "true" || meta?.jacuzziEnabled === true;
      const jacuzziFee = Number(meta?.jacuzziFee ?? 0);

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

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(resRef);
        const existsAlready = snap.exists;
        const nowTs = admin.firestore.Timestamp.now();

        console.log("💾 Guardando reserva - existe?:", existsAlready);

        const baseReservationPayload: any = {
          houseId: houseIds.length === 1 ? houseIds[0] : houseIds.join("__"),
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
          jacuzzi: jacuzziEnabled ? { enabled: true, fee: jacuzziFee } : { enabled: false, fee: 0 },
          jacuzziFee,
          grandTotal,
          discountedGrandTotal,
          currency,
          status: "reserved",
          createdAt: existsAlready ? snap.data()?.createdAt || nowTs : nowTs,
          // paidAt marks moment of receiving notification that first-night payment was successful
          paidAt: nowTs,
          montonioOrderUuid: uuid || null,
          montonioNotification: payload, // save payload for audit
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

        if (discountKind === "coupon" && couponId && Number(couponAmountApplied) > 0) {
          console.log("💳 Aplicando cupón:", couponId);
          const couponBlock = await applyCouponInTx(tx, {
            couponId,
            couponCode,
            couponAmountApplied,
            reservationId,
            checkoutSessionId: uuid || "montonio",
          });
          baseReservationPayload.coupon = couponBlock;
        } else if (discountKind === "percent" && percentId) {
          console.log("📊 Aplicando descuento porcentual:", percentId);
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
          console.log("✨ Creando nueva reserva");
          tx.set(resRef, baseReservationPayload);
        } else {
          console.log("🔄 Actualizando reserva existente");
          tx.update(resRef, baseReservationPayload);
        }
      });

      console.log("✅ Reserva procesada exitosamente:", reservationId);
      return NextResponse.json({ received: true });
    }

    // failed/cancelled/expired
    if (statusFromMontonio === "expired" || statusFromMontonio === "cancelled" || statusFromMontonio === "failed") {
      console.log("❌ Pago fallido/cancelado:", statusFromMontonio);
      const reservationId = merchantReference || payload?.reservationId;
      if (reservationId) {
        const resRef = db.collection("reservations").doc(reservationId);
        await resRef.set({
          status: "canceled",
          paymentRejectedReason: `montonio_${statusFromMontonio}`,
          canceledAt: admin.firestore.Timestamp.now(),
          montonioNotification: payload,
          montonioStatus: statusFromMontonio,
          montonioOrderUuid: uuid || admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
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
    return NextResponse.json({ error: err?.message || "internal_error" }, { status: 500 });
  }
}
