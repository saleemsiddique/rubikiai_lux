// app/api/montonio/coupon/checkout/route.ts
import jwt from "jsonwebtoken";
import axios from "axios";
import { NextResponse } from "next/server";
import admin, { adminDb as db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

if (!process.env.MONTONIO_ACCESS_KEY || !process.env.MONTONIO_SECRET_KEY) {
  console.warn("Montonio keys not configured (MONTONIO_ACCESS_KEY / MONTONIO_SECRET_KEY)");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const unitAmount = Number(body?.unitAmount);
    const quantity = Math.max(1, parseInt(String(body?.quantity || 1), 10));
    const buyerEmail = String(body?.buyerEmail || "").trim();

    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return NextResponse.json({ error: "Invalid unitAmount" }, { status: 400 });
    }

    if (!buyerEmail || !buyerEmail.includes("@")) {
      return NextResponse.json({ error: "buyerEmail required" }, { status: 400 });
    }

    const total = Math.round(unitAmount * quantity * 100) / 100; // two decimals

    // create coupon_orders doc (pending)
    const orderRef = db.collection("coupon_orders").doc();
    const now = admin.firestore.Timestamp.now();

    await orderRef.set({
      status: "pending",
      unitAmount,
      unitAmountCents: Math.round(unitAmount * 100),
      quantity,
      currency: "EUR",
      createdAt: now,
      buyerEmail, // guardamos el correo aquí
    });

    // build montonio payload for coupon purchase
    const montonioPayload: any = {
      accessKey: process.env.MONTONIO_ACCESS_KEY || "",
      merchantReference: orderRef.id,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/coupons/checkout-complete?orderId=${orderRef.id}`,
      notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/montonio/webhook`,
      currency: "EUR",
      grandTotal: Number(total.toFixed(2)),
      locale: "en",
      billingAddress: {
        firstName: "Coupon",
        lastName: "Buyer",
        email: buyerEmail,
        addressLine1: "N/A",
        locality: "City",
        region: "Region",
        country: "EE",
        postalCode: "00000",
      },
      lineItems: [
        {
          name: `Rubikiai Lux Coupon`,
          quantity,
          finalPrice: Number(unitAmount.toFixed(2)),
        },
      ],
      payment: {
        method: "paymentInitiation",
        methodDisplay: "Pay with your bank",
        methodOptions: {
          paymentDescription: `Coupon purchase ${orderRef.id}`,
          preferredCountry: "EE",
        },
        amount: Number(total.toFixed(2)),
        currency: "EUR",
      },
      metadata: {
        type: "coupon",
        orderId: orderRef.id,
        unitAmount: String(unitAmount),
        quantity: String(quantity),
        buyerEmail,
      },
    };

    // sign JWT with MONTONIO_SECRET_KEY
    const token = jwt.sign(montonioPayload, process.env.MONTONIO_SECRET_KEY || "", {
      algorithm: "HS256",
      expiresIn: "10m",
    });

    const apiUrl: string = process.env.MONTONIO_ENVIRONMENT === "production"
      ? "https://stargate.montonio.com/api/orders"
      : "https://sandbox-stargate.montonio.com/api/orders";

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

    // update order doc with montonio response
    try {
      await orderRef.update({
        montonioResponse: response.data || null,
        montonioResponseAt: admin.firestore.Timestamp.now(),
        montonioOrderUuid: response.data?.uuid || response.data?.id || null,
        montonioPaymentUrl: response.data?.paymentUrl || response.data?.payment_url || null,
        status: "pending", // remain pending until webhook marks completed
      });
    } catch (e) {
      console.warn("Could not update coupon_orders with Montonio response:", e);
    }

    const paymentUrl = response.data?.paymentUrl || response.data?.payment_url || null;

    return NextResponse.json({
      url: paymentUrl,
      paymentUrl,
      montonio: response.data,
      orderId: orderRef.id,
    });
  } catch (err: any) {
    console.error("montonio coupon checkout error:", err);
    if (err.response) {
      console.error("Error response data:", err.response.data);
      console.error("Error response status:", err.response.status);
      console.error("Error response headers:", err.response.headers);
    }
    return NextResponse.json({ error: err.response?.data?.message || err.message || "Checkout failed" }, { status: err.response?.status || 500 });
  }
}
