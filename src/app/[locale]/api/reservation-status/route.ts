// app/api/reservation-status/route.ts
import { adminDb } from "@/lib/firebase-admin"; // <-- usa la ruta correcta según tu proyecto
import { NextResponse } from "next/server";

// ya no hace falta volver a inicializar aquí, lo hace lib/firebase-admin.ts
const db = adminDb;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const reservationId = url.searchParams.get("reservationId");
    if (!reservationId) return NextResponse.json({ error: "missing" }, { status: 400 });

    const snap = await db.collection("reservations").doc(reservationId).get();
    if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const data: any = snap.data();
    const expiresAtIso = data.expiresAt && typeof data.expiresAt.toDate === "function" ? data.expiresAt.toDate().toISOString() : data.expiresAt || null;

    // Do not leak internal firestore Timestamp objects; serialize safe fields
    const safe: any = {
      status: data.status,
      total: data.total,
      nights: data.nights,
      firstNightCharge: data.firstNightCharge,
      stripeSessionId: data.stripeSessionId ?? null,
      stripePaymentIntentId: data.stripePaymentIntentId ?? null,
      expiresAtIso,
      refundId: data.refundId ?? null,
      refundStatus: data.refundStatus ?? null,
    };

    return NextResponse.json({ reservation: safe });
  } catch (err) {
    console.error("reservation-status error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
