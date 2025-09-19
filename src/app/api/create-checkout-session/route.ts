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

function dateOnlyIso(value: string) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}
function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/**
 * Devuelve:
 *  - total: importe total de toda la estancia (suma por noche de cada casa + extras)
 *  - nights: número de noches
 *  - firstNightBase: suma de precios solo para la PRIMERA noche (sin extras)
 */
async function calculateTotalAndNights(houseIds: string[], startIso: string, endIso: string, guests: number) {
  // Calcula nights
  const s = new Date(startIso);
  const e = new Date(endIso);
  const nights = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) throw new Error("Invalid date range");

  // iterar por noches y casas para sumar precio total
  let total = 0;
  let firstNightBase = 0;

  for (let i = 0; i < nights; i++) {
    const cur = addDays(new Date(startIso), i);
    const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][cur.getDay()];

    for (const id of houseIds) {
      const doc = await db.collection("houses").doc(id).get();
      if (!doc.exists) throw new Error(`House ${id} not found`);
      const h: any = doc.data();
      const p = h?.pricePerNight?.[weekday];
      if (typeof p !== "number") throw new Error(`Price missing for house ${id} on ${weekday}`);

      total += p;
      if (i === 0) firstNightBase += p; // solo la primera noche
    }
  }

  const includedBase = houseIds.length > 1 ? 4 : 2;
  const EXTRA_GUEST_PRICE = 40; // sincroniza con tu constante
  const extraGuests = Math.max(0, guests - includedBase);

  // total incluye el recargo por extraGuests en cada noche
  total += extraGuests * EXTRA_GUEST_PRICE * nights;

  // firstNightCharge: primera noche + recargo por extras (solo 1 noche)
  const firstNightCharge = firstNightBase + extraGuests * EXTRA_GUEST_PRICE;

  return { total, nights, firstNightBase, firstNightCharge };
}

/** básico: comprobación de solapamiento (considera confirmed y pending no expiradas) */
async function anyOverlap(houseIds: string[], startIso: string, endIso: string) {
  const reservationsRef = db.collection("reservations");
  for (const id of houseIds) {
    const q = reservationsRef.where("houseId", "==", id).where("status", "in", ["confirmed", "pending"]);
    const snap = await q.get();
    for (const doc of snap.docs) {
      const data: any = doc.data();
      const ci = dateOnlyIso(data.checkIn);
      const co = dateOnlyIso(data.checkOut);
      // overlap check: not (co <= start || ci >= end)
      if (!(co <= startIso || ci >= endIso)) return true;
    }
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { houseId, start, end, guests } = body;
    if (!houseId || !start || !end) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const startIso = dateOnlyIso(start);
    const endIso = dateOnlyIso(end);

    // resolve duo id: si se manda duo asume join por __
    const houseIds = String(houseId).includes("__") ? String(houseId).split("__").filter(Boolean) : [String(houseId)];

    // 1) re-check overlap antes de reservar (simple)
    const overlap = await anyOverlap(houseIds, startIso, endIso);
    if (overlap) return NextResponse.json({ error: "Dates already booked" }, { status: 409 });

    // 2) calcular total, noches y primer cargo
    const guestsNum = parseInt(String(guests || 2), 10);
    const { total, nights, firstNightBase, firstNightCharge } = await calculateTotalAndNights(houseIds, startIso, endIso, guestsNum);

    const totalCents = Math.round(total * 100);
    const firstChargeCents = Math.round(firstNightCharge * 100);

    // 3) crear reserva pending dentro de transaction para evitar race
    const reservationsRef = db.collection("reservations");
    const reservationRef = reservationsRef.doc();
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)); // 15 min

    await db.runTransaction(async (tx) => {
      // re-check quickly (read conflicting docs)
      const stillOverlap = await anyOverlap(houseIds, startIso, endIso);
      if (stillOverlap) throw new Error("Dates taken (race)");
      tx.set(reservationRef, {
        houseId,
        houseIds,
        checkIn: startIso,
        checkOut: endIso,
        guests: guestsNum,
        nights,
        total, // total de toda la estancia (para mostrar más tarde)
        currency: "EUR",
        status: "pending",
        createdAt: now,
        expiresAt,
        // guardamos info del primer cargo para referencia
        firstNightBase,
        firstNightCharge,
      } as any);
    });

    // 4) crear sesión de checkout cobrando SOLO el primer cargo (firstNightCharge)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Reservation ${houseId} ${startIso} → ${endIso}`,
              description: `First night (${startIso}) — charges first night only`,
            },
            unit_amount: firstChargeCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        reservationId: reservationRef.id,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/thanks?reservationId=${reservationRef.id}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationRef.id}`,
    }, { idempotencyKey: reservationRef.id });

    // attach stripe session id / url
    await reservationRef.update({ stripeSessionId: session.id, stripeCheckoutUrl: session.url });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("create-checkout-session error:", err);
    return NextResponse.json({ error: err?.message ?? "internal_error" }, { status: 500 });
  }
}
