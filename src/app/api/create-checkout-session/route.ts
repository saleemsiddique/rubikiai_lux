// app/api/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

// init firebase-admin once
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

/* ---------------- Business constants ---------------- */
const EXTRA_GUEST_PRICE = 40; // € per extra guest per night
// Jacuzzi: 65€ covers up to 2 people, +10€/extra guest, flat once per stay
const JACUZZI_BASE_PRICE = 65;
const JACUZZI_EXTRA_PRICE = 10;

/* ---------------- Types ---------------- */
type CheckoutBody = {
  houseId?: string;        // could be "a__b"
  houseSlug?: string;
  start: string | Date;
  end: string | Date;
  guests: number;
  type?: string;

  // NEW unified discount payload sent from checkout-details
  discount?: {
    kind?: "coupon" | "percent";
    id?: string;          // coupon doc id OR percentage_discounts doc id
    code?: string;        // human-readable code
    value?: number;       // coupon: euros to try to apply; percent: % number
  };

  customer?: {
    email?: string;
    name?: string;
    phone?: string; // E.164
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string; // ISO2
    };
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

/* ---------------- Date utils (LOCAL) ---------------- */
function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Date -> YYYY-MM-DD (LOCAL, no UTC shift) */
function dateIsoLocal(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

/** Normalize different shapes to Date at local 00:00 */
function toDateOnlyLocal(value: any): Date {
  let d: Date;
  if (value === undefined || value === null || value === "") {
    throw new Error(`Invalid date value (empty): ${String(value)}`);
  }
  if (typeof value?.toDate === "function") {
    d = value.toDate();
  } else if (
    typeof value === "object" &&
    (typeof (value as any).seconds === "number" ||
      typeof (value as any)._seconds === "number")
  ) {
    const seconds = (value as any).seconds ?? (value as any)._seconds;
    d = new Date(seconds * 1000);
  } else if (value instanceof Date) {
    d = value;
  } else if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      // "YYYY-MM-DD"
      const [y, m, day] = value.split("-").map(Number);
      d = new Date(y, (m || 1) - 1, day || 1); // LOCAL
    } else {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        const maybe = value.split("T")[0];
        const parsed2 = new Date(maybe);
        if (Number.isNaN(parsed2.getTime()))
          throw new Error(`Invalid date string: ${value}`);
        d = parsed2;
      } else {
        d = parsed;
      }
    }
  } else {
    d = new Date(String(value));
  }
  if (Number.isNaN(d.getTime()))
    throw new Error(`Invalid date value: ${String(value)}`);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "YYYY-MM-DD" -> Date at local 00:00 */
function dateFromIsoLocal(iso: string) {
  const [y, m, day] = (iso || "").split("-").map(Number);
  if (![y, m, day].every(Number.isFinite))
    throw new Error(`Invalid ISO date-only string: ${iso}`);
  const d = new Date(y, (m as number) - 1, day as number);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDaysLocal(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  r.setHours(0, 0, 0, 0);
  return r;
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

// Round to 2 decimals
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// Stripe rule: we can't leave an initial charge between 0.01€ and 0.49€.
// Given the first night price and a discount we're *trying* to apply,
// return the final allowed discount.
function adjustForStripeMin(firstNightBefore: number, discountTry: number) {
  const STRIPE_MIN = 0.5; // 0.50€
  const tentative = firstNightBefore - discountTry;

  // If the guest pays 0 or less -> ok
  if (tentative <= 0) return round2(discountTry);

  // If they pay >=0.50 -> ok
  if (tentative >= STRIPE_MIN) return round2(discountTry);

  // If we'd leave 0.01–0.49, try snapping to 0.50
  const neededToPay50 = firstNightBefore - STRIPE_MIN;
  let adjusted = Math.min(discountTry, neededToPay50);
  if (adjusted < 0) adjusted = 0;

  const afterAdjust = firstNightBefore - adjusted;
  if (afterAdjust > 0 && afterAdjust < STRIPE_MIN) {
    // still illegal → just cover full first night (pay 0 now)
    adjusted = Math.min(discountTry, firstNightBefore);
  }

  return round2(adjusted);
}

/* ---------------- Firestore helpers ---------------- */
async function fetchHouseDoc(id: string) {
  const snap = await db.collection("houses").doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return {
    id: snap.id,
    alias: data.alias || "",
    name: data.name || "",
    type: data.type ?? null,
    maxGuests: typeof data.maxGuests === "number" ? data.maxGuests : null,
    includedGuests:
      typeof data.includedGuests === "number" ? data.includedGuests : 2,
    pricePerNight:
      typeof data.pricePerNight === "object" && data.pricePerNight
        ? data.pricePerNight
        : {},
    specialPrices:
      typeof data.specialPrices === "object" && data.specialPrices
        ? data.specialPrices
        : {},
  };
}

/** Price for a given date:
 * 1) specialPrices["YYYY-MM-DD"] wins
 * 2) otherwise pricePerNight[weekday]
 */
function getPriceForDate(house: any, d: Date): number | null {
  if (!house) return null;
  const iso = dateIsoLocal(d);
  const sp = house?.specialPrices?.[iso];
  if (typeof sp === "number") return sp;
  const key = weekdayKey(d);
  const val = house?.pricePerNight?.[key];
  return typeof val === "number" ? val : null;
}

/* ---------------- House resolver ---------------- */
async function resolveHouseIds(values: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const v of values) {
    const idCandidate = String(v);

    // 1) direct doc id
    const doc = await db.collection("houses").doc(idCandidate).get();
    if (doc.exists) {
      out.push(doc.id);
      continue;
    }

    // 2) alias
    const q = await db
      .collection("houses")
      .where("alias", "==", idCandidate)
      .limit(1)
      .get();
    if (!q.empty) {
      out.push(q.docs[0].id);
      continue;
    }

    // 3) type fallback
    const q2 = await db
      .collection("houses")
      .where("type", "==", idCandidate)
      .limit(1)
      .get();
    if (!q2.empty) {
      out.push(q2.docs[0].id);
      continue;
    }

    throw new Error(`House identifier not found as docId or alias: ${v}`);
  }
  return out;
}

/* ---------------- Availability check ---------------- */
function shouldIncludeReservation(res: any) {
  const status = String(res?.status ?? "").toLowerCase();
  return status === "admin" || status === "reserved" || status === "complete";
}

async function fetchReservationsForId(id: string) {
  const map = new Map<string, any>();
  const ref = db.collection("reservations");

  // houseId == id
  const s1 = await ref.where("houseId", "==", id).get();
  s1.docs.forEach((d) => map.set(d.id, d.data()));

  // houseIds array-contains id
  const s2 = await ref.where("houseIds", "array-contains", id).get();
  s2.docs.forEach((d) => map.set(d.id, d.data()));

  return Array.from(map.values());
}

/* ---------------- Price calculation ---------------- */
/**
 * Returns:
 *  - totalNightsOnly: sum of all nights + extra guest surcharges
 *  - firstNightCharge: price of first night + extra guest surcharge
 *  - nights, includedBase, extraGuests
 */
async function calculateNightsCore(
  houseIds: string[],
  startIsoLocal: string,
  endIsoLocal: string,
  guests: number
) {
  // Load houses
  const houses: any[] = [];
  for (const id of houseIds) {
    const h = await fetchHouseDoc(id);
    if (!h) throw new Error(`House ${id} not found`);
    houses.push(h);
  }

  const start = dateFromIsoLocal(startIsoLocal);
  const end = dateFromIsoLocal(endIsoLocal);

  const nights = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (nights <= 0) throw new Error("Invalid date range");

  // included guests across *all* booked units
  const includedBase = houses.reduce(
    (acc, h) =>
      acc + (typeof h.includedGuests === "number" ? h.includedGuests : 2),
    0
  );

  const extraGuests = Math.max(0, guests - includedBase);
  const perNightSurcharge = extraGuests * EXTRA_GUEST_PRICE;

  let totalNightsOnly = 0;
  let firstNightBase = 0;

  for (let i = 0; i < nights; i++) {
    const cur = addDaysLocal(start, i);
    let nightlySum = 0;

    for (const h of houses) {
      const p = getPriceForDate(h, cur);
      if (p === null) {
        throw new Error(
          `Price missing for ${h.id} on ${dateIsoLocal(
            cur
          )} (special or weekday)`
        );
      }
      nightlySum += p;
      if (i === 0) firstNightBase += p;
    }

    nightlySum += perNightSurcharge;
    totalNightsOnly += nightlySum;
  }

  const firstNightCharge = firstNightBase + perNightSurcharge;

  return {
    totalNightsOnly,
    nights,
    firstNightCharge,
    includedBase,
    extraGuests,
  };
}

/* ---------------- Stripe customer helper ---------------- */
async function getOrCreateStripeCustomer(
  input?: CheckoutBody["customer"]
) {
  const email = String(input?.email || "").trim().toLowerCase();

  if (email) {
    // reuse if known
    const key = email;
    const mapRef = db.collection("stripe_customer_by_email").doc(key);
    const mapSnap = await mapRef.get();
    if (mapSnap.exists) {
      const existing = mapSnap.data() as { stripeCustomerId: string };
      return existing.stripeCustomerId;
    }

    // else create
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return customer.id;
  }

  // no email => create ad-hoc customer
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
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutBody;
    console.debug("create-checkout-session body:", body);

    const {
      houseId,
      start,
      end,
      guests,
      houseSlug,
      discount, // <-- unified discount payload
    } = body || {};

    const extras = body?.extras || {};
    const customerInput = body.customer || {};

    // --- 1. Validate dates ---
    let startIso = "";
    let endIso = "";
    try {
      const s = toDateOnlyLocal(start);
      const e = toDateOnlyLocal(end);
      startIso = dateIsoLocal(s);
      endIso = dateIsoLocal(e);
      if (e.getTime() <= s.getTime()) {
        return NextResponse.json(
          { error: "Invalid date range: end must be after start" },
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
        { error: "Missing params: houseId or houseSlug required" },
        { status: 400 }
      );
    }

    // --- 2. Resolve actual Firestore houseIds ---
    const rawValue = houseId || houseSlug!;
    const rawParts = String(rawValue)
      .split("__")
      .map((s) => s.trim())
      .filter(Boolean);
    const houseIds = await resolveHouseIds(rawParts);

    // --- 3. Check availability again ---
    for (const id of houseIds) {
      const reservations = await fetchReservationsForId(id);
      for (const r of reservations) {
        if (!shouldIncludeReservation(r)) continue;
        const ci = toDateOnlyLocal(r.checkIn);
        const co = toDateOnlyLocal(r.checkOut);
        const ciIso = dateIsoLocal(ci);
        const coIso = dateIsoLocal(co);
        // overlap if !(co <= start || ci >= end)
        if (!(coIso <= startIso || ciIso >= endIso)) {
          return NextResponse.json(
            { error: "Dates already booked" },
            { status: 409 }
          );
        }
      }
    }

    // --- 4. Guests ---
    const guestsNum = Number.isFinite(Number(guests))
      ? parseInt(String(guests || 2), 10)
      : 2;
    if (!Number.isFinite(guestsNum) || guestsNum <= 0) {
      return NextResponse.json(
        { error: "Invalid guests number" },
        { status: 400 }
      );
    }

    // --- 5. Core price (no jacuzzi) ---
    const {
      totalNightsOnly,
      nights,
      firstNightCharge,
      includedBase,
      extraGuests,
    } = await calculateNightsCore(houseIds, startIso, endIso, guestsNum);

    // --- 6. Jacuzzi fee (flat per stay, paid on arrival in your UX) ---
    let jacuzziFee = 0;
    let jacuzziEnabled = false;
    if (extras?.jacuzzi?.enabled) {
      jacuzziEnabled = true;
      const jacuzziExtraGuests = Math.max(0, guestsNum - 2);
      jacuzziFee =
        JACUZZI_BASE_PRICE + jacuzziExtraGuests * JACUZZI_EXTRA_PRICE;
    }

    // grandTotal = full stay (lodging + extraGuests surcharge) + jacuzzi flat
    const grandTotal = totalNightsOnly + jacuzziFee;

    // --- 7. Discount logic ---
    // We need to figure out how much we are *actually* discounting:
    //
    // Rules:
    //  - coupon (kind === "coupon"):
    //        discount.value is "euros to try", front already sanity-picked.
    //        We re-validate remaining in Firestore.
    //        We apply up to that amount, but:
    //           * cannot exceed firstNightCharge
    //           * cannot exceed grandTotal
    //        then we run Stripe min rule (no 0.01-0.49 € left).
    //
    //  - percent (kind === "percent"):
    //        discount.value is the percent number (e.g. 10 for 10%).
    //        It ONLY applies to the first night.
    //        So we compute discountOnFirstNight = pct * firstNightCharge.
    //        Then we clamp by grandTotal.
    //        Then adjust Stripe min.
    //
    // Final:
    //   effectiveDiscountAmount = euros that we will consume now.
    //   discountedFirst        = firstNightCharge - effectiveDiscountAmount
    //   discountedGrandTotal   = grandTotal      - effectiveDiscountAmount
    //
    // IMPORTANT: for percent, we're effectively treating it
    // as "a euro discount equal to pct of first night".
    // This matches CheckoutDetailsClient.

    let effectiveDiscountAmount = 0;
    let discountKindForMeta: string = "";
    let discountCodeForMeta: string = "";
    let discountIdForMeta: string = "";
    let percentValueForMeta: string = "";

    if (discount?.kind === "coupon") {
      // 1. read coupon doc
      const couponDocId = discount.id || "";
      if (!couponDocId) {
        return NextResponse.json(
          { error: "Missing coupon id" },
          { status: 400 }
        );
      }
      const snap = await db.collection("coupons").doc(couponDocId).get();
      if (!snap.exists) {
        return NextResponse.json(
          { error: "Coupon not found" },
          { status: 400 }
        );
      }
      const cData: any = snap.data();
      const remaining = Number(cData?.remaining ?? 0);
      const status = String(cData?.status || "active").toLowerCase();

      if (status !== "active") {
        return NextResponse.json(
          { error: "Coupon inactive" },
          { status: 400 }
        );
      }
      if (!Number.isFinite(remaining) || remaining <= 0) {
        return NextResponse.json(
          { error: "Coupon has no remaining balance" },
          { status: 400 }
        );
      }

      // front-suggested max usage
      let proposed = Number(discount.value || 0);
      if (!Number.isFinite(proposed) || proposed <= 0) {
        return NextResponse.json(
          { error: "Invalid coupon value" },
          { status: 400 }
        );
      }

      // can't exceed remaining, firstNightCharge, or grandTotal
      proposed = Math.min(proposed, remaining, firstNightCharge, grandTotal);

      // Stripe min guard
      proposed = adjustForStripeMin(firstNightCharge, proposed);

      if (proposed > 0) {
        effectiveDiscountAmount = proposed;
        discountKindForMeta = "coupon";
        discountCodeForMeta = String(discount.code || cData?.code || "");
        discountIdForMeta = couponDocId;
      }
    } else if (discount?.kind === "percent") {
      // 1. read percentage_discounts doc
      const percentDocId = discount.id || "";
      if (!percentDocId) {
        return NextResponse.json(
          { error: "Missing percent discount id" },
          { status: 400 }
        );
      }
      const snap = await db
        .collection("percentage_discounts")
        .doc(percentDocId)
        .get();
      if (!snap.exists) {
        return NextResponse.json(
          { error: "Percent discount not found" },
          { status: 400 }
        );
      }

      const pData: any = snap.data();
      const used = !!pData?.used;

      // pData.percent is authoritative, but fallback to discount.value
      const pctRaw = Number(pData?.percent ?? discount.value ?? 0);
      const pct = pctRaw / 100;

      // expiry check
      const expStr = String(pData?.expiresAt || "").trim();
      if (used) {
        return NextResponse.json(
          { error: "Discount already used" },
          { status: 400 }
        );
      }
      if (!Number.isFinite(pctRaw) || pctRaw <= 0 || pctRaw > 100) {
        return NextResponse.json(
          { error: "Invalid percent value" },
          { status: 400 }
        );
      }
      if (expStr) {
        const expTime = new Date(expStr + "T23:59:59").getTime();
        if (Date.now() > expTime) {
          return NextResponse.json(
            { error: "Discount expired" },
            { status: 400 }
          );
        }
      }

      // We ONLY discount the first night.
      // discountOnFirstNight = firstNightCharge * pct
      let proposed = firstNightCharge * pct;

      // don't discount more than grandTotal
      if (proposed > grandTotal) {
        proposed = grandTotal;
      }

      // Stripe min guard on firstNightCharge
      proposed = adjustForStripeMin(firstNightCharge, proposed);

      if (proposed > 0) {
        effectiveDiscountAmount = proposed;
        discountKindForMeta = "percent";
        discountCodeForMeta = String(discount.code || pData?.code || "");
        discountIdForMeta = percentDocId;
        percentValueForMeta = String(pctRaw);
      }
    }

    // apply effectiveDiscountAmount to totals
    const discountedFirst = Math.max(
      0,
      firstNightCharge - effectiveDiscountAmount
    );
    const discountedGrandTotal = Math.max(
      0,
      grandTotal - effectiveDiscountAmount
    );

    const discountedFirstCents = Math.round(discountedFirst * 100);

    const isFreeOrder = discountedFirstCents <= 0;

    // --- 8. Stripe customer ---
    const stripeCustomerId = await getOrCreateStripeCustomer(customerInput);

    // --- 9. Provisional reservationId (we'll persist in webhook) ---
    const reservationRef = db.collection("reservations").doc();
    const reservationId = reservationRef.id;

    // --- 10. Create Stripe checkout session ---
    const methodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      isFreeOrder ? [] : ["card", "paypal"];

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      ...(isFreeOrder
        ? {}
        : {
            payment_method_types: methodTypes,
          }),
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Reservation ${rawValue} ${startIso} → ${endIso}`,
              description:
                effectiveDiscountAmount > 0
                  ? `First night (${startIso}) — discount ${discountCodeForMeta || discountIdForMeta} applied`
                  : `First night (${startIso})`,
            },
            unit_amount: Math.max(0, discountedFirstCents),
          },
          quantity: 1,
        },
      ],
      metadata: {
        // --- identification ---
        reservationId,
        noPayment: isFreeOrder ? "true" : "false",

        // --- stay info ---
        houseIds: houseIds.join(","),
        rawValue,
        checkIn: startIso,
        checkOut: endIso,
        nights: String(nights),
        guests: String(guestsNum),
        includedBase: String(includedBase),
        extraGuests: String(extraGuests),

        // --- pricing breakdown ---
        totalNightsOnly: String(totalNightsOnly),
        firstNightCharge: String(firstNightCharge),
        discountedFirst: String(discountedFirst),
        jacuzziEnabled: jacuzziEnabled ? "true" : "false",
        jacuzziFee: String(jacuzziFee),
        grandTotal: String(grandTotal),
        discountedGrandTotal: String(discountedGrandTotal),
        currency: "EUR",

        // --- discount info (kept in coupon* keys for webhook compatibility) ---
        discountKind: discountKindForMeta,
        couponId: effectiveDiscountAmount > 0 ? String(discountIdForMeta) : "",
        couponCode:
          effectiveDiscountAmount > 0 ? String(discountCodeForMeta) : "",
        couponAmountApplied:
          effectiveDiscountAmount > 0
            ? String(effectiveDiscountAmount)
            : "",
        percentValue:
          discountKindForMeta === "percent"
            ? percentValueForMeta
            : "",

        // --- customer info for webhook -> Firestore reservation doc ---
        app_user_id: customerInput?.userId || "",
        customerEmail: customerInput?.email || "",
        customerName: customerInput?.name || "",
        customerPhone: customerInput?.phone || "",
        arrivalTime: customerInput?.arrivalTime || "",
        comment: customerInput?.comment || "",
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/checkout-complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: reservationId,
    });

    // --- 11. Return checkout URL ---
    console.debug("create-checkout:", {
      houseIds,
      nights,
      firstNightCharge,
      jacuzziFee,
      grandTotal,
      effectiveDiscountAmount,
      discountedFirst,
      discountedGrandTotal,
      discountKindForMeta,
      reservationId,
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
