// app/api/montonio/coupon/checkout/route.ts
import jwt from "jsonwebtoken";
import axios from "axios";
import { NextResponse } from "next/server";
import admin, { adminDb as db } from "@/lib/firebase-admin";
import { nowInLithuania } from "@/app/[locale]/utils/date-server";
import { getTranslations } from 'next-intl/server';

type CheckoutBody = {
  unitAmount: number;
  quantity: number;
  buyerEmail?: string;
};

if (!process.env.MONTONIO_ACCESS_KEY || !process.env.MONTONIO_SECRET_KEY) {
  console.warn("Montonio keys not configured");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  try {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'api.errors' });
    const body = (await req.json()) as CheckoutBody;
    console.debug("montonio/coupon/checkout body:", body);

    const { unitAmount, quantity, buyerEmail } = body;

    if (!unitAmount || !quantity) {
      return NextResponse.json({ error: t('missingParams') }, { status: 400 });
    }

    if (!buyerEmail || !buyerEmail.includes("@")) {
      return NextResponse.json({ error: t('invalidEmail') }, { status: 400 });
    }

    // Create order document ID
    const orderRef = db.collection("coupon_orders").doc();
    const orderId = orderRef.id;

    const grandTotal = unitAmount * quantity;

    // Build Montonio payload with CORRECT metadata type
    const montonioPayload: any = {
      accessKey: process.env.MONTONIO_ACCESS_KEY || "",
      merchantReference: orderId,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/coupons/montonio/return?orderId=${orderId}`,
      notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/montonio/webhook`,
      currency: "EUR",
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      locale: locale || "lt", // Use user's locale for Montonio UI
      billingAddress: {
        firstName: buyerEmail.split("@")[0] || "Coupon",
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
          name: "Rubikiai Lux Coupon",
          quantity: quantity,
          finalPrice: parseFloat(grandTotal.toFixed(2)),
        },
      ],
      payment: {
        method: "paymentInitiation",
        methodDisplay: "Pay with your bank",
        methodOptions: {
          paymentDescription: `Coupon purchase ${orderId}`,
          preferredCountry: "LT",
        },
        amount: parseFloat(grandTotal.toFixed(2)),
        currency: "EUR",
      },
      // CRITICAL: Add metadata with type="coupon"
      metadata: {
        type: "coupon",
        orderId: orderId,
        unitAmount: String(unitAmount),
        quantity: String(quantity),
        currency: "EUR",
        buyerEmail: buyerEmail,
        locale: locale || "lt",
      },
    };

    console.log("📦 Montonio coupon payload metadata:", montonioPayload.metadata);

    // Sign JWT
    const token = jwt.sign(montonioPayload, process.env.MONTONIO_SECRET_KEY || "", {
      algorithm: "HS256",
      expiresIn: "10m",
    });

    const apiUrl = process.env.MONTONIO_ENVIRONMENT === "production"
      ? "https://stargate.montonio.com/api/orders"
      : "https://sandbox-stargate.montonio.com/api/orders";

    console.log("Montonio coupon checkout - API URL:", apiUrl);
    console.log("Montonio coupon checkout - orderId:", orderId);
    console.log("Montonio coupon checkout - grandTotal:", grandTotal);

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

    const paymentUrl = response.data?.paymentUrl || response.data?.payment_url || null;
    const montonioUuid = response.data?.uuid || null;

    if (!paymentUrl) {
      throw new Error("Montonio did not return a payment URL");
    }

    // Create initial coupon_order document
    await orderRef.set({
      status: "pending",
      unitAmount,
      unitAmountCents: Math.round(unitAmount * 100),
      quantity,
      currency: "EUR",
      buyerEmail,
      locale: locale || "lt", // Save locale for email fallback
      createdAt: nowInLithuania(),
      montonioOrderUuid: montonioUuid,
      montonioResponse: response.data || null,
      montonioResponseAt: nowInLithuania(),
      montonioPaymentUrl: paymentUrl,
    });

    console.log("✅ Coupon order created:", orderId);

    return NextResponse.json({
      url: paymentUrl,
      orderId: orderId,
      montonio: response.data,
    });
  } catch (error: any) {
    console.error("Montonio coupon checkout error:", error);
    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
    }
    try {
      const { locale } = await params;
      const t = await getTranslations({ locale, namespace: 'api.errors' });
      return NextResponse.json(
        { error: error.response?.data?.message || error.message || t('checkoutFailed') },
        { status: error.response?.status || 500 }
      );
    } catch {
      return NextResponse.json(
        { error: error.response?.data?.message || error.message || "Checkout failed" },
        { status: error.response?.status || 500 }
      );
    }
  }
}