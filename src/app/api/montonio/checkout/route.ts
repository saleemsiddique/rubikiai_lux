// app/api/montonio/checkout/route.ts
import { NextResponse } from "next/server";
import admin, { adminDb as db } from "@/lib/firebase-admin";

const MONTONIO_API_BASE = process.env.MONTONIO_API_BASE!;

const MONTONIO_API_KEY = process.env.MONTONIO_API_KEY!; // tu API key de Montonio

import {
  toDateOnlyLocal,
  dateIsoLocal,
  dateFromIsoLocal,
  calculateNightsCore,
  resolveHouseIds,
} from "@/lib/checkout-utils"; // mueve funciones comunes a este helper

type CheckoutBody = {
  houseId?: string;
  houseSlug?: string;
  start: string | Date;
  end: string | Date;
  guests: number;
  extras?: { jacuzzi?: { enabled: boolean; price?: number } };
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
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutBody;

    // 1. Validar fechas
    const startIso = dateIsoLocal(toDateOnlyLocal(body.start));
    const endIso = dateIsoLocal(toDateOnlyLocal(body.end));
    if (dateFromIsoLocal(endIso).getTime() <= dateFromIsoLocal(startIso).getTime()) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    if (!body.houseId && !body.houseSlug) {
      return NextResponse.json({ error: "Missing houseId or houseSlug" }, { status: 400 });
    }

    // 2. Resolver houseIds
    const rawValue = body.houseId || body.houseSlug!;
    const rawParts = String(rawValue).split("__").map(s => s.trim()).filter(Boolean);
    const houseIds = await resolveHouseIds(rawParts);

    // 3. Calcular precios y noches
    const guestsNum = Number(body.guests || 2);
    const { totalNightsOnly, nights, firstNightCharge, includedBase, extraGuests } =
      await calculateNightsCore(houseIds, startIso, endIso, guestsNum);

    // 4. Jacuzzi
    let jacuzziFee = 0;
    if (body.extras?.jacuzzi?.enabled) {
      const extra = Math.max(0, guestsNum - 2);
      jacuzziFee = 65 + extra * 10; // igual que Stripe
    }

    const grandTotal = totalNightsOnly + jacuzziFee;

    // 5. Descuento
    let effectiveDiscountAmount = 0;
    if (body.discount?.kind === "coupon") {
      const snap = await db.collection("coupons").doc(body.discount.id!).get();
      if (snap.exists) {
        const remaining = Number(snap.data()?.remaining ?? 0);
        const proposed = Math.min(Number(body.discount.value ?? 0), remaining, firstNightCharge, grandTotal);
        effectiveDiscountAmount = Math.max(0, proposed);
      }
    } else if (body.discount?.kind === "percent") {
      const snap = await db.collection("percentage_discounts").doc(body.discount.id!).get();
      if (snap.exists) {
        const pct = Number(snap.data()?.percent ?? body.discount.value ?? 0) / 100;
        effectiveDiscountAmount = Math.min(firstNightCharge * pct, grandTotal);
      }
    }

    const discountedGrandTotal = Math.max(0, grandTotal - effectiveDiscountAmount);

    // 6. Crear orden Montonio
    const reservationRef = db.collection("reservations").doc();
    const reservationId = reservationRef.id;

    const orderPayload = {
      amount: Math.round(discountedGrandTotal * 100), // en céntimos
      currency: "EUR",
      reference: reservationId,
      customer: {
        email: body.customer?.email || "unknown@example.com", // provisional para debug
        name: body.customer?.name,
        phone: body.customer?.phone,
      },
      items: [
        {
          name: `Reservation ${houseIds.join(", ")} ${startIso} → ${endIso}`,
          quantity: 1,
          unit_price: Math.round(discountedGrandTotal * 100),
        }
      ],
      // success/cancel URLs
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/checkout-complete?reservationId=${reservationId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel?reservationId=${reservationId}`,
      metadata: {
        houseIds: houseIds.join(","),
        startIso,
        endIso,
        nights: String(nights),
        guests: String(guestsNum),
        jacuzziFee: String(jacuzziFee),
        discount: String(effectiveDiscountAmount),
      },
    };

    const res = await fetch(`${MONTONIO_API_BASE}/stargate/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MONTONIO_API_KEY}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      let errorText = "";
      try {
        errorText = await res.text();
      } catch { }
      console.error("Montonio checkout failed", res.status, errorText);
      return NextResponse.json({ error: "montonio_error" }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ url: data.checkout_url });
  } catch (err: any) {
    console.error("Montonio checkout error", err);
    return NextResponse.json({ error: err?.message || "internal_error" }, { status: 500 });
  }
}
