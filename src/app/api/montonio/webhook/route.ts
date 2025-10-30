// src/app/api/montonio/webhook/route.ts
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const WEBHOOK_SECRET = process.env.MONTONIO_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    if (!WEBHOOK_SECRET) {
      console.error("MONTONIO_WEBHOOK_SECRET not set");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const body = await req.json();
    const orderToken = body?.orderToken || (body?.data && body.data.orderToken) || null;

    if (!orderToken) {
      console.warn("Webhook received without orderToken", body);
      return NextResponse.json({ error: "Missing orderToken" }, { status: 400 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(orderToken, WEBHOOK_SECRET);
    } catch (err) {
      console.error("Invalid order token:", err);
      return NextResponse.json({ error: "Invalid order token" }, { status: 400 });
    }

    // Aquí: procesa decoded (status, merchantReference, uuid, amount, etc.)
    console.log("Montonio webhook decoded:", decoded);

    // TODO: actualizar tu DB/reserva aquí (idempotencia)
    // p.e. await updateReservation(decoded.merchant_reference, decoded.status);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
