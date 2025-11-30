// app/api/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import admin, { adminDb as db } from "@/lib/firebase-admin";
import {
  dateFromIsoLocal,
  addDaysLocal,
  toDateOnlyLocal,
  calculateNightsCore,
  resolveHouseIds
} from "@/lib/checkout-utils";
import { nowInLithuania } from "@/app/[locale]/utils/date-server";
import { getTranslations } from 'next-intl/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

/* ---------------- Business constants ---------------- */
const JACUZZI_BASE_PRICE = 65;
const JACUZZI_EXTRA_PRICE = 10;

/* ---------------- Types ---------------- */
type CheckoutBody = {
  houseId?: string;
  houseSlug?: string;
  start: string | Date;
  end: string | Date;
  guests: number;
  type?: string;

  cancelUrl?: string;

  pricing?: {
    payNow?: number;   // EUR, e.g. 140.0
    totalStay?: number;
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
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
    userId?: string;
    arrivalTime?: string;
    comment?: string;
  };

  extras?: {
    jacuzzi?: {
      enabled: boolean;
      days?: number;  // ✅ AÑADIDO
      price?: number;
    };
  };
};

/* ---------------- Date utils (LOCAL) ---------------- */
function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function dateIsoLocal(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function weekdayKey(date: Date) {
  const map = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;
  return map[date.getDay()];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function adjustForStripeMin(firstNightBefore: number, discountTry: number) {
  const STRIPE_MIN = 0.5;
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

/* ---------------- Firestore helpers ---------------- */
function shouldIncludeReservation(res: any) {
  const status = String(res?.status ?? "").toLowerCase();
  return status === "admin" || status === "reserved" || status === "complete";
}

async function fetchReservationsForId(id: string) {
  const map = new Map<string, any>();
  const ref = db.collection("reservations");

  const s1 = await ref.where("houseId", "==", id).get();
  s1.docs.forEach((d) => map.set(d.id, d.data()));

  const s2 = await ref.where("houseIds", "array-contains", id).get();
  s2.docs.forEach((d) => map.set(d.id, d.data()));

  return Array.from(map.values());
}

/* ---------------- Stripe customer helper ---------------- */
async function getOrCreateStripeCustomer(input?: CheckoutBody["customer"]) {
  const email = String(input?.email || "").trim().toLowerCase();

  if (email) {
    const key = email;
    const mapRef = db.collection("stripe_customer_by_email").doc(key);
    const mapSnap = await mapRef.get();
    if (mapSnap.exists) {
      const existing = mapSnap.data() as { stripeCustomerId: string };
      return existing.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email,
      name: input?.name,
      phone: input?.phone,
      address: input?.address,
      metadata: {
        app_user_id: input?.userId || "",
        source: "checkout-reservation",
      },
    });

    await mapRef.set({
      stripeCustomerId: customer.id,
      createdAt: nowInLithuania(),
    });

    return customer.id;
  }

  const customer = await stripe.customers.create({
    name: input?.name,
    phone: input?.phone,
    address: input?.address,
    metadata: {
      app_user_id: input?.userId || "",
      source: "checkout-reservation",
    },
  });

  return customer.id;
}

/* ---------------- Handler ---------------- */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  try {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'api.errors' });
    const body = (await req.json()) as CheckoutBody;
    console.debug("create-checkout-session body:", body);

    const {
      houseId,
      start,
      end,
      guests,
      houseSlug,
      discount,
      cancelUrl, // ✅ AÑADIR AQUÍ
    } = body || {};

    const extras = body?.extras || {};
    const customerInput = body.customer || {};
    const pricingFromClient = body?.pricing;

    // 1. Validate / normalize dates
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
      console.error("Invalid start/end passed to checkout:", e?.message);
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

    // 2. Resolve actual Firestore houseIds
    const rawValue = houseId || houseSlug!;
    const rawParts = String(rawValue)
      .split("__")
      .map((s) => s.trim())
      .filter(Boolean);
    const houseIds = await resolveHouseIds(rawParts);

    // 3. Check availability
    for (const id of houseIds) {
      const reservations = await fetchReservationsForId(id);
      for (const r of reservations) {
        if (!shouldIncludeReservation(r)) continue;
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

    // 4. Guests
    const guestsNum = Number.isFinite(Number(guests))
      ? parseInt(String(guests || 2), 10)
      : 2;
    if (!Number.isFinite(guestsNum) || guestsNum <= 0) {
      return NextResponse.json(
        { error: t('invalidGuestsNumber') },
        { status: 400 }
      );
    }

    // 5. Core price (no jacuzzi)
    const {
      totalNightsOnly,
      nights,
      firstNightCharge,
      includedBase,
      extraGuests,
    } = await calculateNightsCore(houseIds, startIso, endIso, guestsNum);

    // ✅ 6. Jacuzzi fee (multi-day calculation - MISMO CÓDIGO QUE MONTONIO)
    let jacuzziFee = 0;
    let jacuzziEnabled = false;
    let jacuzziDays = 0;

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

      // IMPORTANT: use combined jacuzzi capacity (server currently assumes 2 per unit)
      // If you need to count only houses that have jacuzzi, adapt resolveHouseIds to return flags.
      const jacuzziExtraGuests = Math.max(0, guestsNum - 2 * houseIds.length);

      // Primer día: 65€ por unidad + 10€ por guest extra (sobre capacidad combinada)
      const firstDayFee = houseIds.length * JACUZZI_BASE_PRICE + jacuzziExtraGuests * JACUZZI_EXTRA_PRICE;

      // Días adicionales: 45€ por unidad + 10€ por guest extra por día
      const additionalDays = Math.max(0, jacuzziDays - 1);
      const additionalDaysFee = additionalDays * (houseIds.length * 45 + jacuzziExtraGuests * JACUZZI_EXTRA_PRICE);

      jacuzziFee = firstDayFee + additionalDaysFee;
    }

    // grandTotal = lodging + jacuzzi
    const grandTotal = round2(totalNightsOnly + jacuzziFee);

    // 7. Discount logic (server still validates discounts if provided)
    let effectiveDiscountAmount = 0;
    let discountKindForMeta: string = "";
    let discountCodeForMeta: string = "";
    let discountIdForMeta: string = "";
    let percentValueForMeta: string = "";

    if (discount?.kind === "coupon") {
      const couponDocId = discount.id || "";
      if (!couponDocId) {
        return NextResponse.json(
          { error: t('missingCouponId') },
          { status: 400 }
        );
      }
      const snap = await db.collection("coupons").doc(couponDocId).get();
      if (!snap.exists) {
        return NextResponse.json(
          { error: t('couponNotFound') },
          { status: 400 }
        );
      }
      const cData: any = snap.data();
      const remaining = Number(cData?.remaining ?? 0);
      const status = String(cData?.status || "active").toLowerCase();

      if (status !== "active") {
        return NextResponse.json(
          { error: t('couponInactive') },
          { status: 400 }
        );
      }
      if (!Number.isFinite(remaining) || remaining <= 0) {
        return NextResponse.json(
          { error: t('couponNoBalance') },
          { status: 400 }
        );
      }

      let proposed = Number(discount.value || 0);
      if (!Number.isFinite(proposed) || proposed <= 0) {
        return NextResponse.json(
          { error: t('invalidCouponValue') },
          { status: 400 }
        );
      }

      // cap coupon to remaining, firstNightCharge, grandTotal
      proposed = Math.min(proposed, remaining, firstNightCharge, grandTotal);
      proposed = adjustForStripeMin(firstNightCharge, proposed);

      if (proposed > 0) {
        effectiveDiscountAmount = proposed;
        discountKindForMeta = "coupon";
        discountCodeForMeta = String(discount.code || cData?.code || "");
        discountIdForMeta = couponDocId;
      }
    } else if (discount?.kind === "percent") {
      const percentDocId = discount.id || "";
      if (!percentDocId) {
        return NextResponse.json(
          { error: t('missingDiscountId') },
          { status: 400 }
        );
      }
      const snap = await db
        .collection("percentage_discounts")
        .doc(percentDocId)
        .get();
      if (!snap.exists) {
        return NextResponse.json(
          { error: t('discountNotFound') },
          { status: 400 }
        );
      }

      const pData: any = snap.data();
      const used = !!pData?.used;

      const pctRaw = Number(pData?.percent ?? discount.value ?? 0);
      const pct = pctRaw / 100;

      const expStr = String(pData?.expiresAt || "").trim();

      if (used) {
        return NextResponse.json(
          { error: t('discountAlreadyUsed') },
          { status: 400 }
        );
      }
      if (!Number.isFinite(pctRaw) || pctRaw <= 0 || pctRaw > 100) {
        return NextResponse.json(
          { error: t('invalidPercentValue') },
          { status: 400 }
        );
      }
      if (expStr) {
        const expTime = new Date(expStr + "T23:59:59").getTime();
        if (Date.now() > expTime) {
          return NextResponse.json(
            { error: t('discountExpired') },
            { status: 400 }
          );
        }
      }

      let proposed = firstNightCharge * pct;

      if (proposed > grandTotal) {
        proposed = grandTotal;
      }

      proposed = adjustForStripeMin(firstNightCharge, proposed);

      if (proposed > 0) {
        effectiveDiscountAmount = proposed;
        discountKindForMeta = "percent";
        discountCodeForMeta = String(discount.code || pData?.code || "");
        discountIdForMeta = percentDocId;
        percentValueForMeta = String(pctRaw);
      }
    }

    // If client provided pricing, validate and prefer it for the Stripe charge.
    // This ensures Stripe charges exactly the "Charge now" shown in the UI.
    let payNow: number;
    let totalStay: number;

    if (
      pricingFromClient &&
      typeof pricingFromClient.payNow === "number" &&
      typeof pricingFromClient.totalStay === "number"
    ) {
      const clientPayNow = round2(Number(pricingFromClient.payNow));
      const clientTotalStay = round2(Number(pricingFromClient.totalStay));

      // Basic validations
      if (!Number.isFinite(clientPayNow) || clientPayNow < 0) {
        return NextResponse.json({ error: t('invalidPricingPayNow') }, { status: 400 });
      }
      if (!Number.isFinite(clientTotalStay) || clientTotalStay < 0) {
        return NextResponse.json({ error: t('invalidPricingTotal') }, { status: 400 });
      }
      if (clientPayNow > clientTotalStay + 0.001) {
        return NextResponse.json({ error: t('pricingPayNowExceedsTotal') }, { status: 400 });
      }

      // --- Reemplazar la validación estricta por una validación tolerante ---
      const ALLOWED_POSITIVE_DELTA = 5.0; // euros permitidos de diferencia positiva (frontend > server)
      const NEGATIVE_TOLERANCE = 0.99; // si clientTotalStay < serverTotal - 0.99 => rechazamos (cliente intenta pagar menos)

      // Calcular el total del servidor DESPUÉS del descuento para comparar correctamente
      const serverTotalAfterDiscount = round2(grandTotal - effectiveDiscountAmount);

      if (clientTotalStay < serverTotalAfterDiscount - NEGATIVE_TOLERANCE) {
        // Cliente intentando pagar MENOS de lo que el servidor calcula -> reject
        return NextResponse.json(
          { error: t('priceMismatch') },
          { status: 400 }
        );
      }

      // Si clientTotalStay excede al serverGrandTotal por una fracción pequeña, lo aceptamos
      let clientTotalMismatch = false;
      if (clientTotalStay > serverTotalAfterDiscount + ALLOWED_POSITIVE_DELTA) {
        // Si la diferencia es grande, puedes elegir RECHAZAR en lugar de aceptar.
        // Aquí lo aceptamos pero lo marcamos en metadata para auditoría.
        console.warn("Client totalStay exceeds server calculated total but within tolerance? No: exceeds ALLOWED_POSITIVE_DELTA", {
          clientTotalStay,
          serverTotalAfterDiscount,
          effectiveDiscountAmount,
          ALLOWED_POSITIVE_DELTA,
        });

        // Si quieres ser más restrictivo cambia este 'if' por un return que rechace.
        // Para ahora, marcamos mismatch para que quede en metadata:
        clientTotalMismatch = true;
      }

      // OK: aceptamos los valores del cliente (ya validados más arriba)
      payNow = clientPayNow;
      totalStay = clientTotalStay;
    } else {
      // fallback to server-calculated values (apply discount on firstNightCharge)
      const discountedFirst = Math.max(0, round2(firstNightCharge - effectiveDiscountAmount));
      const discountedGrandTotal = Math.max(0, round2(grandTotal - effectiveDiscountAmount));

      payNow = discountedFirst;
      totalStay = discountedGrandTotal;
    }

    // compute payAtArrival based on the chosen totals
    const payAtArrival = Math.max(0, round2(totalStay - payNow));

    const discountedFirstCents = Math.round(payNow * 100);
    const isFreeOrder = discountedFirstCents <= 0;

    // 8. Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(customerInput);

    // 9. provisional reservationId
    const reservationRef = db.collection("reservations").doc();
    const reservationId = reservationRef.id;

    // 10. Create Stripe Checkout Session
    const methodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      isFreeOrder ? [] : ["card", "paypal"];

    // Get Stripe product translations
    const tStripe = await getTranslations({ locale, namespace: 'api.stripe' });

    const productName = tStripe('reservationProductName', {
      property: rawValue,
      checkIn: startIso,
      checkOut: endIso
    });

    const productDescription = effectiveDiscountAmount > 0
      ? tStripe('reservationFeeWithDiscount', {
          date: startIso,
          code: discountCodeForMeta || discountIdForMeta
        })
      : tStripe('reservationFeeDescription', { date: startIso });

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      ...(isFreeOrder
        ? {}
        : {
          payment_method_types: methodTypes,
        }),
      customer: stripeCustomerId,
      locale: locale as Stripe.Checkout.SessionCreateParams.Locale, // Stripe UI locale
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: Math.max(0, discountedFirstCents),
          },
          quantity: 1,
        },
      ],
      metadata: {
        reservationId,
        noPayment: isFreeOrder ? "true" : "false",

        houseIds: houseIds.join(","),
        rawValue,
        checkIn: startIso,
        checkOut: endIso,
        nights: String(nights),
        guests: String(guestsNum),
        includedBase: String(includedBase),
        extraGuests: String(extraGuests),

        // SIMPLIFIED FIELDS - reflect the chosen values
        payNow: String(payNow),
        payAtArrival: String(payAtArrival),
        totalStay: String(totalStay),

        // legacy fields (for compatibility)
        totalNightsOnly: String(totalNightsOnly),
        firstNightCharge: String(firstNightCharge),
        discountedFirst: String(payNow),
        jacuzziEnabled: jacuzziEnabled ? "true" : "false",
        jacuzziFee: String(jacuzziFee),
        jacuzziDays: String(jacuzziDays),
        grandTotal: String(grandTotal),
        discountedGrandTotal: String(Math.max(0, round2(grandTotal - effectiveDiscountAmount))),

        currency: "EUR",

        // discounts
        discountKind: discountKindForMeta,
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
        locale: locale || "lt",
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/api/checkout-complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/${locale}`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: reservationId,
    });

    console.debug("create-checkout:", {
      houseIds,
      nights,
      payNow,
      payAtArrival,
      totalStay,
      jacuzziFee,
      jacuzziDays,
      effectiveDiscountAmount,
      discountKindForMeta,
      reservationId,
      locale, // Log locale to verify it's being passed correctly
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("create-checkout-session error:", err);
    return NextResponse.json(
      { error: err?.message ?? "internal_error" },
      { status: 500 }
    );
  }
}
