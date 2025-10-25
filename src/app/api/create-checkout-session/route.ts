// app/api/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

// inicializar firebase-admin (solo para leer Firestore y generar IDs)
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

/* ---------------- Constantes de negocio ---------------- */
const EXTRA_GUEST_PRICE = 40; // € por persona extra y noche

// Jacuzzi: 65€ cubre hasta 2 personas, +10€/persona adicional. Cargo único por estancia.
const JACUZZI_BASE_PRICE = 65;
const JACUZZI_EXTRA_PRICE = 10;

/* ---------------- Tipos ---------------- */
type CheckoutBody = {
  houseId?: string;        // puede ser "a__b"
  houseSlug?: string;      // fallback tipo slug/alias
  start: string | Date;
  end: string | Date;
  guests: number;
  type?: string;
  coupon?: { id: string; amount: number };

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
    userId?: string; // id interno app
    arrivalTime?: string;
    comment?: string;
  };

  extras?: {
    jacuzzi?: {
      enabled: boolean;
      price?: number; // total jacuzziFee calculado en frontend según backend /price
    };
  };
};

/* ---------------- Fechas (LOCAL) ---------------- */
function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Date -> YYYY-MM-DD (LOCAL, sin UTC/ISO) */
function dateIsoLocal(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

/** Normaliza varios tipos a Date a las 00:00 (LOCAL). Lanza si no válido. */
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
      // ISO completa
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

/** YYYY-MM-DD (LOCAL) -> Date (LOCAL 00:00) */
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

/* ---------------- Houses / precios ---------------- */
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
      typeof data.includedGuests === "number" ? data.includedGuests : 2, // default
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

/** Precio para una fecha: PRIORIDAD specialPrices[YYYY-MM-DD] -> pricePerNight[weekday] */
function getPriceForDate(house: any, d: Date): number | null {
  if (!house) return null;
  const iso = dateIsoLocal(d);
  const sp = house?.specialPrices?.[iso];
  if (typeof sp === "number") return sp;
  const key = weekdayKey(d);
  const val = house?.pricePerNight?.[key];
  return typeof val === "number" ? val : null;
}

/* ---------------- Resolver ids ---------------- */
async function resolveHouseIds(values: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const v of values) {
    const idCandidate = String(v);

    // 1) directamente como document id
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

    // 3) fallback por "type"
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

/* ---------------- Ocupación ---------------- */
/**
 * Solo bloquean calendario estas reservas:
 * - 'admin' (bloqueo manual)
 * - 'reserved' (pagada / confirmada)
 * - 'complete' (estancia pasada pero tenemos histórico)
 *
 * NO contamos nada 'pending', 'expired', 'canceled', etc.
 */
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

/* ---------------- Cálculo total/primer cargo ---------------- */
/**
 * Devuelve:
 *  - totalNightsOnly: total alojamiento + suplemento persona extra (todas las noches)
 *  - firstNightCharge: cargo de la primera noche (alojamiento + extraGuests)
 *  - nights, includedBase, extraGuests
 */
async function calculateNightsCore(
  houseIds: string[],
  startIsoLocal: string,
  endIsoLocal: string,
  guests: number
) {
  // Cargar docs de las casas
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

  // Invitados incluidos sumando las unidades (2 por unidad default)
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

/* ---------------- Stripe Customer helper ---------------- */
async function getOrCreateStripeCustomer(input?: CheckoutBody["customer"]) {
  const email = String(input?.email || "").trim().toLowerCase();

  if (email) {
    // Reutiliza customer por email si ya lo tenemos mapeado
    const key = email;
    const mapRef = db.collection("stripe_customer_by_email").doc(key);
    const mapSnap = await mapRef.get();
    if (mapSnap.exists) {
      const existing = mapSnap.data() as { stripeCustomerId: string };
      return existing.stripeCustomerId;
    }

    // Crea uno nuevo en Stripe
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

    // Guarda mapeo email -> stripeCustomerId
    await mapRef.set({
      stripeCustomerId: customer.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return customer.id;
  }

  // Sin email: creamos un customer "ad hoc"
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

    const { houseId, start, end, guests, houseSlug } = body || {};
    const coupon = body?.coupon;
    const extras = body?.extras || {};
    const customerInput = body.customer || {};

    // --- 1. Validación de fechas ---
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

    // --- 2. Resolver ids reales de la(s) casa(s) ---
    const rawValue = houseId || houseSlug!;
    const rawParts = String(rawValue)
      .split("__")
      .map((s) => s.trim())
      .filter(Boolean);
    const houseIds = await resolveHouseIds(rawParts);

    // --- 3. Re-check overlap con reservas ya confirmadas ---
    for (const id of houseIds) {
      const reservations = await fetchReservationsForId(id);
      for (const r of reservations) {
        if (!shouldIncludeReservation(r)) continue;
        const ci = toDateOnlyLocal(r.checkIn);
        const co = toDateOnlyLocal(r.checkOut);
        const ciIso = dateIsoLocal(ci);
        const coIso = dateIsoLocal(co);
        // solape si !(co <= start || ci >= end)
        if (!(coIso <= startIso || ciIso >= endIso)) {
          return NextResponse.json(
            { error: "Dates already booked" },
            { status: 409 }
          );
        }
      }
    }

    // --- 4. nº huéspedes ---
    const guestsNum = Number.isFinite(Number(guests))
      ? parseInt(String(guests || 2), 10)
      : 2;
    if (!Number.isFinite(guestsNum) || guestsNum <= 0) {
      return NextResponse.json(
        { error: "Invalid guests number" },
        { status: 400 }
      );
    }

    // --- 5. Cálculo de noches / primera noche (sin jacuzzi) ---
    const {
      totalNightsOnly,
      nights,
      firstNightCharge,
      includedBase,
      extraGuests,
    } = await calculateNightsCore(houseIds, startIso, endIso, guestsNum);

    // --- 6. Jacuzzi (cargo único por estancia) ---
    let jacuzziFee = 0;
    let jacuzziEnabled = false;
    if (extras?.jacuzzi?.enabled) {
      jacuzziEnabled = true;
      const jacuzziExtraGuests = Math.max(0, guestsNum - 2);
      jacuzziFee =
        JACUZZI_BASE_PRICE + jacuzziExtraGuests * JACUZZI_EXTRA_PRICE;
    }

    // total final de la estancia con jacuzzi
    const grandTotal = totalNightsOnly + jacuzziFee;

    // --- 7. Cupón (opcional) ---
    let couponAmountToApply = 0;
    let couponCode: string | null = null;

    if (coupon && coupon.id && Number.isFinite(Number(coupon.amount))) {
      const couponDoc = await db
        .collection("coupons")
        .doc(String(coupon.id))
        .get();
      if (!couponDoc.exists) {
        return NextResponse.json(
          { error: "Coupon not found" },
          { status: 400 }
        );
      }

      const cdata: any = couponDoc.data();
      const remaining = Number(cdata?.remaining ?? 0);
      couponCode = String(cdata?.code || "");
      couponAmountToApply = Math.max(0, Number(coupon.amount));

      if (couponAmountToApply <= 0) {
        return NextResponse.json(
          { error: "Coupon amount must be > 0" },
          { status: 400 }
        );
      }
      if (couponAmountToApply > remaining) {
        return NextResponse.json(
          { error: "Coupon amount exceeds remaining balance" },
          { status: 400 }
        );
      }
      if (couponAmountToApply > grandTotal + 1e-6) {
        return NextResponse.json(
          { error: "Coupon amount exceeds reservation total" },
          { status: 400 }
        );
      }
    }

    // aplicamos cupón contra "depósito inicial" y total global
    const discountedGrandTotal = Math.max(
      0,
      grandTotal - couponAmountToApply
    );
    const discountedFirst = Math.max(
      0,
      firstNightCharge - couponAmountToApply
    );

    const discountedFirstCents = Math.round(discountedFirst * 100);
    const isFreeOrder = discountedFirstCents <= 0;

    // --- 8. Stripe Customer ---
    const stripeCustomerId = await getOrCreateStripeCustomer(customerInput);

    // --- 9. Generar un reservationId provisional ---
    // OJO: NO creamos el doc aquí. Solo generamos la ID que usaremos luego en el webhook
    const reservationRef = db.collection("reservations").doc();
    const reservationId = reservationRef.id;

    // --- 10. Crear la sesión de Stripe ---
    // quitamos customer_balance (te daba error)
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
                couponAmountToApply > 0
                  ? `First night (${startIso}) — coupon ${couponCode || coupon!.id} applied`
                  : `First night (${startIso})`,
            },
            unit_amount: Math.max(0, discountedFirstCents),
          },
          quantity: 1,
        },
      ],
      metadata: {
        // --- Identificación / control ---
        reservationId,
        noPayment: isFreeOrder ? "true" : "false",

        // --- Stay info ---
        houseIds: houseIds.join(","), // para recrear luego
        rawValue,
        checkIn: startIso,
        checkOut: endIso,
        nights: String(nights),
        guests: String(guestsNum),
        includedBase: String(includedBase),
        extraGuests: String(extraGuests),

        // --- Pricing breakdown ---
        totalNightsOnly: String(totalNightsOnly),
        firstNightCharge: String(firstNightCharge),
        discountedFirst: String(discountedFirst),
        jacuzziEnabled: jacuzziEnabled ? "true" : "false",
        jacuzziFee: String(jacuzziFee),
        grandTotal: String(grandTotal),
        discountedGrandTotal: String(discountedGrandTotal),
        currency: "EUR",

        // --- Coupon info ---
        couponId: couponAmountToApply > 0 ? String(coupon?.id) : "",
        couponCode: couponCode || "",
        couponAmountApplied:
          couponAmountToApply > 0 ? String(couponAmountToApply) : "",

        // --- Customer info for later Firestore create in webhook ---
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

    // --- 11. Devolvemos la URL de Stripe ---
    console.debug("create-checkout:", {
      houseIds,
      totalNightsOnly,
      firstNightCharge,
      discountedFirst,
      jacuzziFee,
      grandTotal,
      discountedGrandTotal,
      isFreeOrder,
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
