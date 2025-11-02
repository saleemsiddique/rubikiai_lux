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

type CheckoutBody = {
  houseId?: string;
  houseSlug?: string;
  start: string | Date;
  end: string | Date;
  guests: number;
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
      price?: number;
    };
  };
};

if (!process.env.MONTONIO_ACCESS_KEY || !process.env.MONTONIO_SECRET_KEY) {
  console.warn("Montonio keys not configured (MONTONIO_ACCESS_KEY / MONTONIO_SECRET_KEY)");
}

/* Business constants same as Stripe flow */
const JACUZZI_BASE_PRICE = 65;
const JACUZZI_EXTRA_PRICE = 10;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Same stripe min helper (to respect minimum payment) */
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutBody;
    console.debug("montonio/checkout body:", body);

    const { houseId, houseSlug, start, end, guests, discount } = body || {};
    const extras = body?.extras || {};
    const customerInput = body?.customer || {};

    // 1. Validate dates and normalize (LOCAL date-only)
    let startIso = "";
    let endIso = "";
    try {
      const s = toDateOnlyLocal(start);
      const e = toDateOnlyLocal(end);
      startIso = dateIsoLocal(s);
      endIso = dateIsoLocal(e);
      if (e.getTime() <= s.getTime()) {
        return NextResponse.json({ error: "Invalid date range: end must be after start" }, { status: 400 });
      }
    } catch (e: any) {
      console.error("Invalid start/end passed to montonio checkout:", e?.message);
      return NextResponse.json({ error: `Invalid start/end date: ${e?.message}` }, { status: 400 });
    }

    if (!houseId && !houseSlug) {
      return NextResponse.json({ error: "Missing params: houseId or houseSlug required" }, { status: 400 });
    }

    // 2. Resolve actual houseIds (same helper as Stripe)
    const rawValue = houseId || houseSlug!;
    const rawParts = String(rawValue).split("__").map((s) => s.trim()).filter(Boolean);
    const houseIds = await resolveHouseIds(rawParts);

    // 3. Check availability (same logic as Stripe flow)
    const ref = db.collection("reservations");
    for (const id of houseIds) {
      // fetch reservations
      const reservations = await (async function fetchReservationsForId(id: string) {
        const map = new Map<string, any>();
        const s1 = await ref.where("houseId", "==", id).get();
        s1.docs.forEach((d) => map.set(d.id, d.data()));
        const s2 = await ref.where("houseIds", "array-contains", id).get();
        s2.docs.forEach((d) => map.set(d.id, d.data()));
        return Array.from(map.values());
      })(id);

      for (const r of reservations) {
        const status = String(r?.status ?? "").toLowerCase();
        if (!(status === "admin" || status === "reserved" || status === "complete")) continue;
        const ci = toDateOnlyLocal(r.checkIn);
        const co = toDateOnlyLocal(r.checkOut);
        const ciIso = dateIsoLocal(ci);
        const coIso = dateIsoLocal(co);
        if (!(coIso <= startIso || ciIso >= endIso)) {
          return NextResponse.json({ error: "Dates already booked" }, { status: 409 });
        }
      }
    }

    // 4. Guests normalization
    const guestsNum = Number.isFinite(Number(guests)) ? parseInt(String(guests || 2), 10) : 2;
    if (!Number.isFinite(guestsNum) || guestsNum <= 0) {
      return NextResponse.json({ error: "Invalid guests number" }, { status: 400 });
    }

    // 5. Core price calculation (uses same helper calculateNightsCore as Stripe)
    const { totalNightsOnly, nights, firstNightCharge, includedBase, extraGuests } =
      await calculateNightsCore(houseIds, startIso, endIso, guestsNum);

    // 6. Jacuzzi fee (same rules)
    let jacuzziFee = 0;
    let jacuzziEnabled = false;
    if (extras?.jacuzzi?.enabled) {
      jacuzziEnabled = true;
      const jacuzziExtraGuests = Math.max(0, guestsNum - 2);
      jacuzziFee = JACUZZI_BASE_PRICE + jacuzziExtraGuests * JACUZZI_EXTRA_PRICE;
      // If client sent a price, trust server-side calculation (we don't use client price to guard)
    }

    // 7. Grand total before discount
    const grandTotal = totalNightsOnly + jacuzziFee;

    // 8. Discount logic (mirror Stripe code)
    let effectiveDiscountAmount = 0;
    let discountKindForMeta: string = "";
    let discountCodeForMeta: string = "";
    let discountIdForMeta: string = "";
    let percentValueForMeta: string = "";

    if (discount?.kind === "coupon") {
      const couponDocId = discount.id || "";
      if (!couponDocId) return NextResponse.json({ error: "Missing coupon id" }, { status: 400 });
      const snap = await db.collection("coupons").doc(couponDocId).get();
      if (!snap.exists) return NextResponse.json({ error: "Coupon not found" }, { status: 400 });
      const cData: any = snap.data();
      const remaining = Number(cData?.remaining ?? 0);
      const status = String(cData?.status || "active").toLowerCase();
      if (status !== "active") return NextResponse.json({ error: "Coupon inactive" }, { status: 400 });
      if (!Number.isFinite(remaining) || remaining <= 0) return NextResponse.json({ error: "Coupon has no remaining balance" }, { status: 400 });

      let proposed = Number(discount.value || 0);
      if (!Number.isFinite(proposed) || proposed <= 0) return NextResponse.json({ error: "Invalid coupon value" }, { status: 400 });

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
      if (!percentDocId) return NextResponse.json({ error: "Missing percent discount id" }, { status: 400 });
      const snap = await db.collection("percentage_discounts").doc(percentDocId).get();
      if (!snap.exists) return NextResponse.json({ error: "Percent discount not found" }, { status: 400 });
      const pData: any = snap.data();
      const used = !!pData?.used;
      const pctRaw = Number(pData?.percent ?? discount.value ?? 0);
      const pct = pctRaw / 100;
      if (used) return NextResponse.json({ error: "Discount already used" }, { status: 400 });
      if (!Number.isFinite(pctRaw) || pctRaw <= 0 || pctRaw > 100) return NextResponse.json({ error: "Invalid percent value" }, { status: 400 });

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

    // 9. Totals after discount
    const discountedFirst = Math.max(0, firstNightCharge - effectiveDiscountAmount);
    const discountedGrandTotal = Math.max(0, grandTotal - effectiveDiscountAmount);

    // 10. Create reservationId (Firestore doc id) but DO NOT write DB yet; webhook will write on payment
    const reservationRef = db.collection("reservations").doc();
    const reservationId = reservationRef.id;

    // 11. Build metadata (the SAME keys Stripe used) — ensure all string values
    const metadata: { [k: string]: string } = {
      reservationId,
      noPayment: discountedGrandTotal <= 0 ? "true" : "false",
      houseIds: houseIds.join(","),
      rawValue,
      checkIn: startIso,
      checkOut: endIso,
      nights: String(nights),
      guests: String(guestsNum),
      includedBase: String(includedBase),
      extraGuests: String(extraGuests),
      totalNightsOnly: String(totalNightsOnly),
      firstNightCharge: String(firstNightCharge),
      discountedFirst: String(discountedFirst),
      jacuzziEnabled: jacuzziEnabled ? "true" : "false",
      jacuzziFee: String(jacuzziFee),
      grandTotal: String(grandTotal),
      discountedGrandTotal: String(discountedGrandTotal),
      currency: "EUR",
      discountKind: discountKindForMeta || "",
      couponId: effectiveDiscountAmount > 0 ? String(discountIdForMeta) : "",
      couponCode: effectiveDiscountAmount > 0 ? String(discountCodeForMeta) : "",
      couponAmountApplied: effectiveDiscountAmount > 0 ? String(effectiveDiscountAmount) : "",
      percentValue: discountKindForMeta === "percent" ? percentValueForMeta : "",
      app_user_id: customerInput?.userId || "",
      customerEmail: customerInput?.email || "",
      customerName: customerInput?.name || "",
      customerPhone: customerInput?.phone || "",
      arrivalTime: customerInput?.arrivalTime || "",
      comment: customerInput?.comment || "",
    };

    // 12. Build Montonio payload and JWT (merchantReference = reservationId to match webhook)
    const montonioPayload: any = {
      accessKey: process.env.MONTONIO_ACCESS_KEY || "",
      merchantReference: reservationId,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?ref=${reservationId}`,
      notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/montonio/webhook`, // Montonio will post here
      currency: "EUR",
      grandTotal: parseFloat(discountedGrandTotal.toFixed(2)),
      locale: "en",
      billingAddress: {
        firstName: (customerInput?.name || "Guest").split(" ")[0] || "Guest",
        lastName: (customerInput?.name || "User").split(" ").slice(1).join(" ") || "User",
        email: customerInput?.email || "",
        addressLine1: "Address Line 1",
        locality: "City",
        region: "Region",
        country: "EE",
        postalCode: "12345",
      },
      lineItems: [
        {
          name: `Accommodation - ${houseSlug || rawValue}`,
          quantity: 1,
          finalPrice: parseFloat(totalNightsOnly.toFixed(2)),
        },
      ],
      payment: {
        method: "paymentInitiation",
        methodDisplay: "Pay with your bank",
        methodOptions: {
          paymentDescription: `Payment for booking ${reservationId}`,
          preferredCountry: "EE",
        },
        amount: parseFloat(discountedGrandTotal.toFixed(2)),
        currency: "EUR",
      },
      metadata, // CRÍTICO: include metadata so webhook can reconstruct reservation
    };

    // Add jacuzzi line item if present
    if (jacuzziEnabled && jacuzziFee > 0) {
      montonioPayload.lineItems.push({
        name: "Private Jacuzzi",
        quantity: 1,
        finalPrice: parseFloat(jacuzziFee.toFixed(2)),
      });
    }

    // Add discount as negative line item if applicable
    if (effectiveDiscountAmount > 0) {
      montonioPayload.lineItems.push({
        name: `Discount ${discountKindForMeta === "coupon" ? `(Code: ${metadata.couponCode})` : `(${metadata.percentValue}%)`}`,
        quantity: 1,
        finalPrice: parseFloat((-effectiveDiscountAmount).toFixed(2)),
      });
    }

    // 13. Sign JWT
    const token = jwt.sign(montonioPayload, process.env.MONTONIO_SECRET_KEY || "", {
      algorithm: "HS256",
      expiresIn: "10m",
    });

    // 14. POST to Montonio API
    const apiUrl: string = process.env.MONTONIO_ENVIRONMENT === "production"
      ? "https://stargate.montonio.com/api/orders"
      : "https://sandbox-stargate.montonio.com/api/orders";

    console.log("Montonio checkout - API URL:", apiUrl);
    console.log("Montonio checkout - Metadata:", metadata);

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

    // If Montonio returned a paymentUrl -> redirect
    const paymentUrl = response.data?.paymentUrl || response.data?.payment_url || null;

    // If discountedGrandTotal <= 0 (free), we can create reservation immediately and return a successUrl
    if (Number(discountedGrandTotal) <= 0) {
      // Write reservation directly as paid (webhook might not be called for free flows)
      const nowTs = admin.firestore.Timestamp.now();
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
        jacuzzi: jacuzziEnabled ? { enabled: true, fee: jacuzziFee } : { enabled: false, fee: 0 },
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

      // create reservation doc
      await reservationRef.set(baseReservationPayload);

      return NextResponse.json({ successUrl: montonioPayload.returnUrl });
    }

    // Otherwise return payment URL to client (Montonio)
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
    return NextResponse.json({ error: error.response?.data?.message || error.message || "Checkout failed" }, { status: error.response?.status || 500 });
  }
}
