// app/api/coupons/lookup/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("code") || "";
    const code = normalizeCode(raw);

    if (!code) {
      return NextResponse.json({ error: "Missing coupon code" }, { status: 400 });
    }

    const snap = await adminDb
      .collection("coupons")
      .where("code", "==", code)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const doc = snap.docs[0];
    const data: any = doc.data();

    const remaining: number = Number(data?.remaining ?? 0);
    const status: string = String(data?.status || "active");

    const purchasedAtIso = data?.purchasedAt?.toDate ? data.purchasedAt.toDate().toISOString() : null;
    const expiresAtIso = data?.expiresAt?.toDate ? data.expiresAt.toDate().toISOString() : null;

    // Simple derived state for UI
    let state: "active" | "expired" | "used" | "disabled" = "active";
    const now = Date.now();
    if (status !== "active") state = "disabled";
    if (typeof remaining === "number" && remaining <= 0.000001) state = "used";
    if (expiresAtIso && new Date(expiresAtIso).getTime() <= now) state = "expired";

    return NextResponse.json({
      coupon: {
        id: doc.id,
        code: data.code,
        currency: data.currency || "EUR",
        unitAmount: Number(data.unitAmount ?? 0),
        remaining,
        status,
        purchasedAtIso,
        expiresAtIso,
        orderId: data.orderId || null,
        buyerEmail: data.buyerEmail || null,
      },
      state,
    });
  } catch (e: any) {
    console.error("coupon lookup error:", e);
    return NextResponse.json({ error: e?.message ?? "server_error" }, { status: 500 });
  }
}
