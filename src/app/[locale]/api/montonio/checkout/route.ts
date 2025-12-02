// app/api/montonio/checkout/route.ts
import jwt from "jsonwebtoken";
import axios from "axios";
import { NextResponse } from "next/server";
import admin, { adminDb as db } from "@/lib/firebase-admin";
import {
  dateFromIsoLocal,
  addDaysLocal,
  toDateOnlyLocal,
  calculateNightsCore,
  resolveHouseIds,
  dateIsoLocal,
} from "@/lib/checkout-utils";
import { nowInLithuania } from "@/app/[locale]/utils/date-server";
import { getTranslations } from 'next-intl/server';

type CheckoutBody = {
  houseId?: string;
  houseSlug?: string;
  start: string | Date;
  end: string | Date;
  guests: number;
  cancelUrl?: string;
  // ✅ NUEVOS CAMPOS DE PRECIO SIMPLIFICADOS
  pricing?: {
    payNow: number;
    totalStay: number;
  };
  discount?: {
    kind?: "coupon" | "percent";
    id?: string;
    code?: string;
    value?: number;
  };
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
    userId?: string;
    arrivalTime?: string;
    comment?: string;
  };
  extras?: {
    jacuzzi?: {
      enabled: boolean;
      days?: number;
      price?: number;
    };
  };
};

if (!process.env.MONTONIO_ACCESS_KEY || !process.env.MONTONIO_SECRET_KEY) {
  console.warn(
    "Montonio keys not configured (MONTONIO_ACCESS_KEY / MONTONIO_SECRET_KEY)"
  );
}

const JACUZZI_BASE_PRICE = 65;
const JACUZZI_EXTRA_PRICE = 10;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function adjustForStripeMin(firstNightBefore: number, discountTry: number) {
  const STRIPE_MIN = 0.5; // 0.50€
  const tentative = firstNightBefore - discountTry;

  if (tentative <= 0) return round2(discountTry);
  if (tentative >= STRIPE_MIN) return round2(discountTry);

  const neededToPay50 = firstNightBefore - STRIPE_MIN;
  let adjusted = Math.min(discountTry, neededToPay50);
  if (adjusted < 0) adjusted = 0;

  const afterAdjust = firstNightBefore - adjusted;
  if (afterAdjust > 0 && afterAdjust < STRIPE_MIN) {
    adjusted = Math.min(discountTry, firstNightBefore);
  }

  return round2(adjusted);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  try {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'api.errors' });
    const body = (await req.json()) as CheckoutBody;
    console.debug("montonio/checkout body:", body);

    const { houseId, houseSlug, start, end, guests, discount, cancelUrl, pricing } = body || {};
    const extras = body?.extras || {};
    const customerInput = body?.customer || {};

    // normalize dates
    let startIso = "";
    let endIso = "";
    try {
      const s = toDateOnlyLocal(start);
      const e = toDateOnlyLocal(end);
      startIso = dateIsoLocal(s);
      endIso = dateIsoLocal(e);
      if (e.getTime() <= s.getTime()) {
        return NextResponse.json(
          { error: t('invalidDateRange') },
          { status: 400 }
        );
      }
    } catch (e: any) {
      console.error(
        "Invalid start/end passed to montonio checkout:",
        e?.message
      );
      return NextResponse.json(
        { error: `Invalid start/end date: ${e?.message}` },
        { status: 400 }
      );
    }

    if (!houseId && !houseSlug) {
      return NextResponse.json(
        { error: t('missingParams') },
        { status: 400 }
      );
    }

    const rawValue = houseId || houseSlug!;
    const rawParts = String(rawValue)
      .split("__")
      .map((s) => s.trim())
      .filter(Boolean);
    const houseIds = await resolveHouseIds(rawParts);

    // availability check (same as Stripe)
    const ref = db.collection("reservations");
    for (const id of houseIds) {
      const map = new Map<string, any>();
      const s1 = await ref.where("houseId", "==", id).get();
      s1.docs.forEach((d) => map.set(d.id, d.data()));
      const s2 = await ref.where("houseIds", "array-contains", id).get();
      s2.docs.forEach((d) => map.set(d.id, d.data()));
      const reservations = Array.from(map.values());

      for (const r of reservations) {
        const status = String(r?.status ?? "").toLowerCase();
        if (
          !(
            status === "admin" ||
            status === "reserved" ||
            status === "complete"
          )
        )
          continue;
        const ci = toDateOnlyLocal(r.checkIn);
        const co = toDateOnlyLocal(r.checkOut);
        const ciIso = dateIsoLocal(ci);
        const coIso = dateIsoLocal(co);
        if (!(coIso <= startIso || ciIso >= endIso)) {
          return NextResponse.json(
            { error: t('datesAlreadyBooked') },
            { status: 409 }
          );
        }
      }
    }

    const guestsNum = Number.isFinite(Number(guests))
      ? parseInt(String(guests || 2), 10)
      : 2;
    if (!Number.isFinite(guestsNum) || guestsNum <= 0) {
      return NextResponse.json(
        { error: t('invalidGuestsNumber') },
        { status: 400 }
      );
    }

    // ✅ SI VIENE pricing DEL FRONTEND, USARLO DIRECTAMENTE (YA TIENE DESCUENTOS APLICADOS)
    let payNow: number;
    let totalStay: number;
    let payAtArrival: number;
    let nights: number;
    let totalNightsOnly: number;
    let firstNightCharge: number;
    let includedBase: number;
    let extraGuests: number;
    let jacuzziFee: number = 0;
    let jacuzziEnabled: boolean = false;
    let jacuzziDays: number = 0;
    let grandTotal: number;
    let discountedFirst: number;
    let discountedGrandTotal: number;
    let effectiveDiscountAmount = 0;
    let discountKindForMeta: string = "";
    let discountCodeForMeta: string = "";
    let discountIdForMeta: string = "";
    let percentValueForMeta: string = "";

    if (pricing && typeof pricing.payNow === 'number' && typeof pricing.totalStay === 'number') {
      // ✅ USAR LOS VALORES QUE VIENEN DEL FRONTEND (YA CALCULADOS CON DESCUENTOS)
      console.log("✅ Usando pricing del frontend:", pricing);
      payNow = pricing.payNow;
      totalStay = pricing.totalStay;
      payAtArrival = Math.max(0, totalStay - payNow);

      // Aún necesitamos calcular algunos valores para metadata
      const coreData = await calculateNightsCore(houseIds, startIso, endIso, guestsNum);
      nights = coreData.nights;
      totalNightsOnly = coreData.totalNightsOnly;
      firstNightCharge = coreData.firstNightCharge;
      includedBase = coreData.includedBase;
      extraGuests = coreData.extraGuests;

      // Calcular jacuzzi para metadata
      if (extras?.jacuzzi?.enabled) {
        jacuzziEnabled = true;
        jacuzziDays = Number(extras?.jacuzzi?.days || 1);
        if (jacuzziDays > nights) jacuzziDays = nights;
        if (jacuzziDays < 1) jacuzziDays = 1;

        // CORRECCIÓN: Para dual, capacidad base = 2 * número de casas
        const jacuzziExtraGuests = Math.max(0, guestsNum - 2 * houseIds.length);
        const firstDayFee = houseIds.length * 65 + (jacuzziExtraGuests * 10);
        const additionalDays = Math.max(0, jacuzziDays - 1);
        const additionalDaysFee = additionalDays * (houseIds.length * 45 + (jacuzziExtraGuests * 10));
        jacuzziFee = firstDayFee + additionalDaysFee;
      }

      // ✅ IMPORTANTE: grandTotal SIEMPRE debe ser el total SIN descuento
      grandTotal = totalNightsOnly + jacuzziFee;
      discountedFirst = payNow;
      discountedGrandTotal = totalStay; // totalStay ya tiene el descuento aplicado

      // Si hay descuento, calcular el effectiveDiscountAmount
      // CORRECCIÓN: el descuento es la diferencia entre grandTotal (sin descuento) y totalStay (con descuento)
      if (discount) {
        effectiveDiscountAmount = Math.max(0, grandTotal - totalStay);
        discountKindForMeta = discount.kind || "";
        discountCodeForMeta = discount.code || "";
        discountIdForMeta = discount.id || "";
        if (discount.kind === "percent") {
          percentValueForMeta = String(discount.value || "");
        }
      }
    } else {
      // ❌ FALLBACK: CALCULAR DESDE CERO (MODO LEGACY)
      console.log("⚠️ No se recibió pricing del frontend, calculando desde cero");
      const coreData = await calculateNightsCore(houseIds, startIso, endIso, guestsNum);
      totalNightsOnly = coreData.totalNightsOnly;
      nights = coreData.nights;
      firstNightCharge = coreData.firstNightCharge;
      includedBase = coreData.includedBase;
      extraGuests = coreData.extraGuests;

      // jacuzzi fee (multi-day calculation)
      if (extras?.jacuzzi?.enabled) {
        jacuzziEnabled = true;
        jacuzziDays = Number(extras?.jacuzzi?.days || 1);

        // Validar que jacuzziDays no exceda nights
        if (jacuzziDays > nights) {
          jacuzziDays = nights;
        }
        if (jacuzziDays < 1) {
          jacuzziDays = 1;
        }

        // CORRECCIÓN: Para dual, capacidad base = 2 * número de casas
        const jacuzziExtraGuests = Math.max(0, guestsNum - 2 * houseIds.length);

        // Primer día: 65€ por casa + 10€ por guest extra
        const firstDayFee = houseIds.length * 65 + (jacuzziExtraGuests * 10);

        // Días adicionales: 45€ por casa + 10€ por guest extra cada día
        const additionalDays = Math.max(0, jacuzziDays - 1);
        const additionalDaysFee = additionalDays * (houseIds.length * 45 + (jacuzziExtraGuests * 10));

        jacuzziFee = firstDayFee + additionalDaysFee;
      }
      // grandTotal = lodging + jacuzzi (full stay)
      grandTotal = totalNightsOnly + jacuzziFee;

      // discount logic (mirror Stripe)
      if (discount?.kind === "coupon") {
        const couponDocId = discount.id || "";
        if (!couponDocId)
          return NextResponse.json(
            { error: t('missingCouponId') },
            { status: 400 }
          );
        const snap = await db.collection("coupons").doc(couponDocId).get();
        if (!snap.exists)
          return NextResponse.json(
            { error: t('couponNotFound') },
            { status: 400 }
          );
        const cData: any = snap.data();
        const remaining = Number(cData?.remaining ?? 0);
        const status = String(cData?.status || "active").toLowerCase();
        if (status !== "active")
          return NextResponse.json({ error: t('couponInactive') }, { status: 400 });
        if (!Number.isFinite(remaining) || remaining <= 0)
          return NextResponse.json(
            { error: t('couponNoBalance') },
            { status: 400 }
          );

        let proposed = Number(discount.value || 0);
        if (!Number.isFinite(proposed) || proposed <= 0)
          return NextResponse.json(
            { error: t('invalidCouponValue') },
            { status: 400 }
          );

        // IMPORTANT: cap by remaining and grandTotal (NOT limited to first night)
        proposed = Math.min(proposed, remaining, grandTotal);
        proposed = adjustForStripeMin(firstNightCharge, proposed);

        if (proposed > 0) {
          effectiveDiscountAmount = proposed;
          discountKindForMeta = "coupon";
          discountCodeForMeta = String(discount.code || cData?.code || "");
          discountIdForMeta = couponDocId;
        }
      } else if (discount?.kind === "percent") {
        const percentDocId = discount.id || "";
        if (!percentDocId)
          return NextResponse.json(
            { error: t('missingDiscountId') },
            { status: 400 }
          );
        const snap = await db
          .collection("percentage_discounts")
          .doc(percentDocId)
          .get();
        if (!snap.exists)
          return NextResponse.json(
            { error: t('discountNotFound') },
            { status: 400 }
          );
        const pData: any = snap.data();
        const used = !!pData?.used;
        const pctRaw = Number(pData?.percent ?? discount.value ?? 0);
        const pct = pctRaw / 100;
        if (used)
          return NextResponse.json(
            { error: t('discountAlreadyUsed') },
            { status: 400 }
          );
        if (!Number.isFinite(pctRaw) || pctRaw <= 0 || pctRaw > 100)
          return NextResponse.json(
            { error: t('invalidPercentValue') },
            { status: 400 }
          );

        // apply only to Reservation fee
        let proposed = firstNightCharge * pct;
        if (proposed > grandTotal) proposed = grandTotal;
        proposed = adjustForStripeMin(firstNightCharge, proposed);

        if (proposed > 0) {
          effectiveDiscountAmount = proposed;
          discountKindForMeta = "percent";
          discountCodeForMeta = String(discount.code || pData?.code || "");
          discountIdForMeta = percentDocId;
          percentValueForMeta = String(pctRaw);
        }
      }

      // totals after discount (only affects Reservation fee now)
      discountedFirst = Math.max(
        0,
        firstNightCharge - effectiveDiscountAmount
      );
      discountedGrandTotal = Math.max(
        0,
        grandTotal - effectiveDiscountAmount
      );
      payNow = discountedFirst; // lo que cobramos ahora
      totalStay = discountedGrandTotal; // total de la estancia
      payAtArrival = Math.max(0, totalStay - payNow); // lo que queda por pagar
    }

    // prepare reservationId (Firestore id) — will be used as merchantReference
    const reservationRef = db.collection("reservations").doc();
    const reservationId = reservationRef.id;

    // build metadata (same keys Stripe uses)
    const metadata: { [k: string]: string } = {
      reservationId,
      noPayment: payNow <= 0 ? "true" : "false",
      houseIds: houseIds.join(","),
      rawValue,
      checkIn: startIso,
      checkOut: endIso,
      nights: String(nights),
      guests: String(guestsNum),

      // CAMPOS SIMPLIFICADOS DE PRECIO
      payNow: String(payNow),
      payAtArrival: String(payAtArrival),
      totalStay: String(totalStay),

      // campos legacy (mantener por compatibilidad si quieres):
      totalNightsOnly: String(totalNightsOnly),
      firstNightCharge: String(firstNightCharge),
      jacuzziFee: String(jacuzziFee),
      jacuzziEnabled: jacuzziEnabled ? "true" : "false",
      jacuzziDays: String(jacuzziDays), // NUEVO CAMPO      grandTotal: String(grandTotal),
      currency: "EUR",

      // descuentos
      discountKind: discountKindForMeta || "",
      couponId:
        effectiveDiscountAmount > 0 && discountKindForMeta === "coupon"
          ? String(discountIdForMeta)
          : "",
      couponCode:
        effectiveDiscountAmount > 0 && discountKindForMeta === "coupon"
          ? String(discountCodeForMeta)
          : "",
      couponAmountApplied:
        effectiveDiscountAmount > 0 && discountKindForMeta === "coupon"
          ? String(effectiveDiscountAmount)
          : "",

      percentId:
        effectiveDiscountAmount > 0 && discountKindForMeta === "percent"
          ? String(discountIdForMeta)
          : "",
      percentCode:
        effectiveDiscountAmount > 0 && discountKindForMeta === "percent"
          ? String(discountCodeForMeta)
          : "",
      percentValue:
        discountKindForMeta === "percent" ? percentValueForMeta : "",
      percentAmountApplied:
        effectiveDiscountAmount > 0 && discountKindForMeta === "percent"
          ? String(effectiveDiscountAmount)
          : "",

      // customer
      app_user_id: customerInput?.userId || "",
      customerEmail: customerInput?.email || "",
      customerName: customerInput?.name || "",
      customerPhone: customerInput?.phone || "",
      arrivalTime: customerInput?.arrivalTime || "",
      comment: customerInput?.comment || "",
      locale: locale || "lt", // locale from route param
    };

    // MONTONIO PAY ONLY Reservation fee: set grandTotal/payment.amount to discountedFirst (lo que debe cobrarse ahora)
    const amountToPayNow = parseFloat(discountedFirst.toFixed(2)); // importe que cobramos ahora (Reservation fee)
    const montonioPayload: any = {
      accessKey: process.env.MONTONIO_ACCESS_KEY || "",
      merchantReference: reservationId,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/payment/success?ref=${reservationId}&cancelUrl=${encodeURIComponent(cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/${locale}`)}`,
      cancelUrl: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/${locale}`,
      notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/montonio/webhook`,
      currency: "EUR",
      grandTotal: amountToPayNow, // IMPORTANT: only Reservation fee
      locale: locale || "lt", // Use locale from route parameter instead of hardcoded "lt"
      billingAddress: {
        firstName: (customerInput?.name || "Guest").split(" ")[0] || "Guest",
        lastName:
          (customerInput?.name || "User").split(" ").slice(1).join(" ") ||
          "User",
        email: customerInput?.email || "",
        addressLine1: "Address Line 1",
        locality: "City",
        region: "Region",
        country: "EE",
        postalCode: "12345",
      },
      // lineItems: represent Reservation fee only (price after discount)
      lineItems: [
        {
          name: `Reservation fee - ${startIso}`,
          quantity: 1,
          finalPrice: parseFloat(discountedFirst.toFixed(2)),
        },
      ],
      payment: {
        method: "paymentInitiation",
        methodDisplay: "Pay with your bank",
        methodOptions: {
          paymentDescription: `Payment for booking ${reservationId} (Reservation fee)`,
          preferredCountry: "LT",
        },
        amount: parseFloat(amountToPayNow.toFixed(2)),
        currency: "EUR",
      },
      metadata,
    };

    // NOTE: NO añadimos linea separada para jacuzzi ni linea de descuento porque:
    // - cobramos solo la Reservation fee (discountedFirst ya lo incorpora)
    // - jacuzziFee se factura/guarda en metadata y se cobrará a la llegada (o como tú gestiones)
    // Esto deja la pasarela cobrando exactamente lo mismo que Stripe (Reservation fee).

    // --- CREATE A LIGHTWEIGHT checkout_intent BEFORE CALLING MONTONIO ---
    // This is NOT the final reservation. It is an intent living for a short TTL.
    // The webhook will use this as fallback if Montonio doesn't echo all metadata.
    try {
      const intentRef = db.collection("checkout_intents").doc(reservationId);
      const nowTs = nowInLithuania();
      await intentRef.set({
        reservationId,
        houseIds,
        checkIn: startIso,
        checkOut: endIso,
        nights,
        guests: guestsNum,
        includedBase,
        extraGuests,
        totalNightsOnly,
        firstNightCharge,
        discountedFirst,
        jacuzziEnabled,
        jacuzziFee,
        grandTotal,
        discountedGrandTotal,
        currency: "EUR",
        metadata, // keep exactly what we send to Montonio
        customer: {
          email: customerInput?.email || null,
          name: customerInput?.name || null,
          phone: customerInput?.phone || null,
          arrivalTime: customerInput?.arrivalTime || null,
          comment: customerInput?.comment || null,
          userId: customerInput?.userId || null,
        },
        createdAt: nowTs,
        // optional: set a TTL or expiresAt if you want to auto-clean
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 1000 * 60 * 60 * 24)
        ), // e.g., 24h
        createdBy: "checkout",
      });
      console.log("✅ checkout_intent created for", reservationId);
    } catch (e) {
      console.error("Failed to create checkout_intent (non-fatal):", e);
      // non-fatal: proceed to create montonio order anyway; webhook will attempt fallback to reservation doc if needed
    }

    // sign JWT
    const token = jwt.sign(
      montonioPayload,
      process.env.MONTONIO_SECRET_KEY || "",
      {
        algorithm: "HS256",
        expiresIn: "10m",
      }
    );

    const apiUrl: string =
      process.env.MONTONIO_ENVIRONMENT === "production"
        ? "https://stargate.montonio.com/api/orders"
        : "https://sandbox-stargate.montonio.com/api/orders";

    console.log("Montonio checkout - API URL:", apiUrl);
    console.log("Montonio checkout - Metadata:", metadata);
    console.log(
      "Montonio checkout - amountToPayNow (Reservation fee):",
      amountToPayNow
    );

    const response = await axios.post(
      apiUrl,
      { data: token },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MONTONIO_ACCESS_KEY}`,
        },
        timeout: 30000,
      }
    );

    // after axios.post and obtaining response
    try {
      await db
        .collection("checkout_intents")
        .doc(reservationId)
        .update({
          montonioResponse: response.data || null,
          montonioResponseAt: nowInLithuania(),
        });
    } catch (e) {
      console.warn(
        "Could not update checkout_intent with Montonio response:",
        e
      );
    }

    const paymentUrl =
      response.data?.paymentUrl || response.data?.payment_url || null;

    // If Reservation fee is free (discountedFirst <= 0) -> create reservation now and return successUrl
    if (Number(amountToPayNow) <= 0) {
      const nowTs = nowInLithuania();
      const baseReservationPayload: any = {
        houseId: houseIds.length === 1 ? houseIds[0] : houseIds.join("__"),
        houseIds,
        checkIn: startIso,
        checkOut: endIso,
        nights,
        guests: guestsNum,
        includedBase,
        extraGuests,
        totalNightsOnly,
        firstNightCharge,
        discountedFirst,
        jacuzzi: jacuzziEnabled
          ? { enabled: true, fee: jacuzziFee, days: jacuzziDays }
          : { enabled: false, fee: 0, days: 0 },
        jacuzziFee,
        grandTotal,
        discountedGrandTotal,
        currency: "EUR",
        status: "reserved",
        createdAt: nowTs,
        paidAt: nowTs,
        montonioOrderUuid: response.data?.uuid || null,
        customerEmail: customerInput?.email || null,
        customer: {
          email: customerInput?.email || null,
          name: customerInput?.name || null,
          phone: customerInput?.phone || null,
          arrivalTime: customerInput?.arrivalTime || null,
          comment: customerInput?.comment || null,
          userId: customerInput?.userId || null,
        },
        metadata,
      };

      await reservationRef.set(baseReservationPayload);

      return NextResponse.json({ successUrl: montonioPayload.returnUrl });
    }

    // normal flow: return Montonio paymentUrl (to pay Reservation fee)
    return NextResponse.json({
      url: paymentUrl,
      merchantReference: reservationId,
      montonio: response.data,
    });
  } catch (error: any) {
    console.error("Montonio checkout error:", error);
    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    }
    return NextResponse.json(
      {
        error:
          error.response?.data?.message || error.message || t('checkoutFailed'),
      },
      { status: error.response?.status || 500 }
    );
  }
}
function t(arg0: string): any {
  throw new Error("Function not implemented.");
}

