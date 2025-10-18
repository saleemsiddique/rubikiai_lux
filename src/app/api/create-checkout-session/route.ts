// app/api/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY! as string);

// inicializar firebase-admin
if (!admin.apps.length) {
  const cred = process.env.FIREBASE_ADMIN_SDK ? JSON.parse(process.env.FIREBASE_ADMIN_SDK) : undefined;
  admin.initializeApp({
    credential: cred ? admin.credential.cert(cred) : admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

// ----------------- helpers -----------------
function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function dateOnlyIso(value: any) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Invalid date value (empty): ${String(value)}`);
  }
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid Firestore Timestamp: ${String(value)}`);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return `${y}-${pad2(m)}-${pad2(day)}`;
  }
  if (typeof value === "object" && (typeof value.seconds === "number" || typeof value._seconds === "number")) {
    const seconds = typeof value.seconds === "number" ? value.seconds : value._seconds;
    const d = new Date(seconds * 1000);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid seconds-based timestamp: ${String(value)}`);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return `${y}-${pad2(m)}-${pad2(day)}`;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`Invalid Date object: ${String(value)}`);
    const d = value;
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return `${y}-${pad2(m)}-${pad2(day)}`;
  }
  if (typeof value === "string") {
    const onlyDateMatch = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (onlyDateMatch) {
      const [y, m, d] = value.split("-").map(Number);
      const dd = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
      if (Number.isNaN(dd.getTime())) throw new Error(`Invalid date string: ${value}`);
      return value;
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      const maybe = value.split("T")[0];
      const d2 = new Date(maybe);
      if (Number.isNaN(d2.getTime())) throw new Error(`Invalid date string: ${value}`);
      const y2 = d2.getUTCFullYear();
      const m2 = d2.getUTCMonth() + 1;
      const day2 = d2.getUTCDate();
      return `${y2}-${pad2(m2)}-${pad2(day2)}`;
    }
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return `${y}-${pad2(m)}-${pad2(day)}`;
  }
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date value (unparseable): ${String(value)}`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${pad2(m)}-${pad2(day)}`;
}
function addDays(d: Date, days: number) {
  const res = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
  return res;
}
function dateFromIsoDateOnlyString(isoDateOnly: string) {
  const [y, m, day] = (isoDateOnly || "").split("-").map(Number);
  if (![y, m, day].every(Number.isFinite)) throw new Error(`Invalid ISO date-only string: ${isoDateOnly}`);
  return new Date(Date.UTC(y, m - 1, day));
}

async function resolveHouseIds(values: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const v of values) {
    const idCandidate = String(v);
    const doc = await db.collection("houses").doc(idCandidate).get();
    if (doc.exists) { out.push(doc.id); continue; }
    const q = await db.collection("houses").where("alias", "==", idCandidate).limit(1).get();
    if (!q.empty) { out.push(q.docs[0].id); continue; }
    const q2 = await db.collection("houses").where("type", "==", idCandidate).limit(1).get();
    if (!q2.empty) { out.push(q2.docs[0].id); continue; }
    throw new Error(`House identifier not found as docId or alias: ${v}`);
  }
  return out;
}

async function calculateTotalAndNights(houseIds: string[], startIso: string, endIso: string, guests: number) {
  const sIso = dateOnlyIso(startIso);
  const eIso = dateOnlyIso(endIso);
  const s = dateFromIsoDateOnlyString(sIso);
  const e = dateFromIsoDateOnlyString(eIso);
  const nights = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) throw new Error("Invalid date range");
  let total = 0;
  let firstNightBase = 0;
  for (let i = 0; i < nights; i++) {
    const cur = addDays(s, i);
    const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][cur.getDay()];
    for (const id of houseIds) {
      const doc = await db.collection("houses").doc(id).get();
      if (!doc.exists) throw new Error(`House ${id} not found`);
      const h: any = doc.data();
      const p = h?.pricePerNight?.[weekday];
      if (typeof p !== "number") throw new Error(`Price missing for house ${id} on ${weekday}`);
      total += p;
      if (i === 0) firstNightBase += p;
    }
  }
  const INCLUDED_BASE_SINGLE = 2;
  const INCLUDED_BASE_DUO = 4;
  const EXTRA_GUEST_PRICE = 0;
  const includedBase = houseIds.length > 1 ? INCLUDED_BASE_DUO : INCLUDED_BASE_SINGLE;
  const extraGuests = Math.max(0, guests - includedBase);
  total += extraGuests * EXTRA_GUEST_PRICE * nights;
  const firstNightCharge = firstNightBase + extraGuests * EXTRA_GUEST_PRICE;
  console.debug("calculateTotalAndNights ->", { houseIds, startIso: sIso, endIso: eIso, nights, firstNightBase, total, extraGuests, firstNightCharge });
  return { total, nights, firstNightBase, firstNightCharge };
}
// ------------- fin helpers ---------------

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.debug("create-checkout-session body:", body);

    const { houseId, start, end, guests, houseSlug } = body || {};
    // Cupón (opcional) enviado desde el cliente cuando el usuario lo aplicó
    const coupon: { id: string; amount: number } | undefined = body?.coupon;

    // Validación de fechas
    try {
      const startIsoTest = dateOnlyIso(start);
      const endIsoTest = dateOnlyIso(end);
      if (new Date(endIsoTest).getTime() <= new Date(startIsoTest).getTime()) {
        return NextResponse.json({ error: "Invalid date range: end must be after start" }, { status: 400 });
      }
    } catch (e: any) {
      console.error("Invalid start/end passed to checkout:", e?.message);
      return NextResponse.json({ error: `Invalid start/end date: ${e?.message}` }, { status: 400 });
    }

    if (!houseId && !houseSlug) {
      return NextResponse.json({ error: "Missing params: houseId or houseSlug required" }, { status: 400 });
    }
    if (!start || !end) return NextResponse.json({ error: "Missing params start/end" }, { status: 400 });

    const rawValue = houseId || houseSlug;
    const rawParts = String(rawValue).includes("__") ? String(rawValue).split("__").filter(Boolean) : [String(rawValue)];
    const houseIds = await resolveHouseIds(rawParts);

    const startIso = dateOnlyIso(start);
    const endIso = dateOnlyIso(end);

    // Re-check overlap rápido (pending + reserved)
    const reservationsRef = db.collection("reservations");
    for (const id of houseIds) {
      const q = reservationsRef.where("houseId", "==", id).where("status", "in", ["reserved", "pending"]);
      const snap = await q.get();
      for (const doc of snap.docs) {
        const data: any = doc.data();
        const ci = dateOnlyIso(data.checkIn);
        const co = dateOnlyIso(data.checkOut);
        if (!(co <= startIso || ci >= endIso)) {
          return NextResponse.json({ error: "Dates already booked" }, { status: 409 });
        }
      }
    }

    const guestsNum = Number.isFinite(Number(guests)) ? parseInt(String(guests || 2), 10) : 2;
    if (!Number.isFinite(guestsNum) || guestsNum <= 0) {
      return NextResponse.json({ error: "Invalid guests number" }, { status: 400 });
    }

    const { total, nights, firstNightBase, firstNightCharge } = await calculateTotalAndNights(houseIds, startIso, endIso, guestsNum);

    // ====== Validación y preparación del cupón (opcional) ======
    let couponAmountToApply = 0;
    let couponCode: string | null = null;

    if (coupon && coupon.id && Number.isFinite(Number(coupon.amount))) {
      const couponDoc = await db.collection("coupons").doc(String(coupon.id)).get();
      if (!couponDoc.exists) {
        return NextResponse.json({ error: "Coupon not found" }, { status: 400 });
      }
      const cdata: any = couponDoc.data();
      const remaining = Number(cdata?.remaining ?? 0);
      couponCode = String(cdata?.code || "");
      // Aplicaremos EUROS enteros (si manejas céntimos en coupons, cámbialo)
      couponAmountToApply = Math.max(0, coupon.amount);

      if (couponAmountToApply <= 0) {
        return NextResponse.json({ error: "Coupon amount must be > 0" }, { status: 400 });
      }
      if (couponAmountToApply > remaining) {
        return NextResponse.json({ error: "Coupon amount exceeds remaining balance" }, { status: 400 });
      }
      if (couponAmountToApply > total + 0.000001) {
        return NextResponse.json({ error: "Coupon amount exceeds reservation total" }, { status: 400 });
      }
    }

    // Totales con descuento por cupón
    const discountedTotal = Math.max(0, total - couponAmountToApply);
    const discountedFirst = Math.max(0, firstNightCharge - couponAmountToApply);

    const discountedFirstCents = Math.round(discountedFirst * 100);

    const isFreeOrder = discountedFirstCents <= 0;

    // ====== 1) crear reserva pending (con info del cupón) ======
    const reservationsRef2 = db.collection("reservations");
    const reservationRef = reservationsRef2.doc();
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)); // 15 min

    await db.runTransaction(async (tx) => {
      for (const id of houseIds) {
        const q = db.collection("reservations").where("houseId", "==", id).where("status", "in", ["reserved", "pending"]);
        const snap = await tx.get(q);
        for (const doc of snap.docs) {
          const data: any = doc.data();
          const ci = dateOnlyIso(data.checkIn);
          const co = dateOnlyIso(data.checkOut);
          if (!(co <= startIso || ci >= endIso)) throw new Error("Dates taken (race)");
        }
      }
      const storeHouseId = houseIds.length === 1 ? houseIds[0] : houseIds.join("__");

      const payload: any = {
        houseId: storeHouseId,
        houseIds,
        checkIn: startIso,
        checkOut: endIso,
        guests: guestsNum,
        nights,
        total,               // total sin descuento
        discountedTotal,     // total tras cupón
        currency: "EUR",
        status: "pending",
        createdAt: now,
        expiresAt,
        firstNightBase,
        firstNightCharge,
        discountedFirst,     // primer cargo tras cupón (puede ser 0)
      };

      if (couponAmountToApply > 0) {
        payload.coupon = {
          id: coupon!.id,
          code: couponCode,
          amountApplied: couponAmountToApply,
          deductedAt: null,  // el webhook marcará cuándo se descuenta realmente
        };
      }

      tx.set(reservationRef, payload);
    });

    // ====== 2) leer y validar pending/no expirado ======
    const freshSnap = await reservationRef.get();
    if (!freshSnap.exists) {
      console.error("Reservation disappeared after creation (unexpected)");
      return NextResponse.json({ error: "Reservation creation failed" }, { status: 500 });
    }
    const freshData: any = freshSnap.data();
    const nowDate = new Date();
    if (freshData.status !== "pending") {
      console.warn("Reservation not pending after creation:", reservationRef.id, freshData.status);
      return NextResponse.json({ error: "Reservation not available", status: 409 }, { status: 409 });
    }
    if (freshData.expiresAt && typeof freshData.expiresAt.toDate === "function") {
      const exp = freshData.expiresAt.toDate();
      if (exp.getTime() <= nowDate.getTime()) {
        await reservationRef.update({ status: "expired", expiredAt: admin.firestore.Timestamp.now(), paymentRejectedReason: "expired_before_checkout" });
        return NextResponse.json({ error: "Reservation expired", status: 409 }, { status: 409 });
      }
    }

    // ====== 3) crear sesión de Stripe (rama normal o free-order) ======
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      // En free-order omitimos payment_intent_data y métodos
      ...(isFreeOrder ? {} : { payment_method_types: ["card"], payment_intent_data: { capture_method: "manual" } }),
      customer_creation: "always",
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
            unit_amount: Math.max(0, discountedFirstCents), // 0€ si free-order
          },
          quantity: 1,
        },
      ],
      metadata: {
        reservationId: reservationRef.id,
        firstNightCharge: String(firstNightCharge),      // referencia (antes de cupón)
        discountedFirst: String(discountedFirst),        // tras cupón (puede ser 0)
        total: String(total),                            // referencia (antes de cupón)
        discountedTotal: String(discountedTotal),        // tras cupón
        guests: String(guestsNum),
        couponId: couponAmountToApply > 0 ? String(coupon!.id) : "",
        couponCode: couponCode || "",
        couponAmountApplied: couponAmountToApply > 0 ? String(couponAmountToApply) : "",
        noPayment: isFreeOrder ? "true" : "false",
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/checkout-complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationRef.id}`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams, { idempotencyKey: reservationRef.id });

    // ====== 4) commit session en la reserva (si sigue pending/no expirada) ======
    let sessionCommitted = false;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(reservationRef);
      if (!snap.exists) {
        throw new Error("Reservation missing while committing session");
      }
      const data: any = snap.data();
      if (data.status !== "pending") {
        if (data.status !== "expired") {
          console.warn("Reservation changed status before committing stripe session:", reservationRef.id, data.status);
        }
        tx.update(reservationRef, { status: "expired", paymentRejectedReason: "expired_before_session_commit", expiredAt: admin.firestore.Timestamp.now(), stripeSessionId: session.id });
        sessionCommitted = false;
        return;
      }
      if (data.expiresAt && typeof data.expiresAt.toDate === "function") {
        const exp = data.expiresAt.toDate();
        if (exp.getTime() <= Date.now()) {
          tx.update(reservationRef, { status: "expired", paymentRejectedReason: "expired_before_session_commit", expiredAt: admin.firestore.Timestamp.now(), stripeSessionId: session.id });
          sessionCommitted = false;
          return;
        }
      }
      tx.update(reservationRef, { stripeSessionId: session.id, stripeCheckoutUrl: session.url });
      sessionCommitted = true;
    });

    if (!sessionCommitted) {
      console.warn("Session created but reservation expired before commit, not returning session URL", reservationRef.id);
      return NextResponse.json({ error: "Reservation expired while creating session" }, { status: 409 });
    }

    console.debug(
      "create-checkout:",
      { houseIds, total, firstNightCharge, discountedFirst, couponApplied: couponAmountToApply, isFreeOrder }
    );
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("create-checkout-session error:", err);
    return NextResponse.json({ error: err?.message ?? "internal_error" }, { status: 500 });
  }
}
