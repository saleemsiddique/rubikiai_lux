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
      return NextResponse.json(
        { error: "Missing coupon code" },
        { status: 400 }
      );
    }

    // 1) Buscar en `coupons` (cupon saldo €)
    const snapValue = await adminDb
      .collection("coupons")
      .where("code", "==", code)
      .limit(1)
      .get();

    if (!snapValue.empty) {
      const doc = snapValue.docs[0];
      const data: any = doc.data();

      const remaining: number = Number(data?.remaining ?? 0);
      const status: string = String(data?.status || "active");

      const purchasedAtIso = data?.purchasedAt?.toDate
        ? data.purchasedAt.toDate().toISOString()
        : null;
      const expiresAtIso = data?.expiresAt?.toDate
        ? data.expiresAt.toDate().toISOString()
        : null;

      // derive state
      let state: "active" | "expired" | "used" | "disabled" = "active";
      const now = Date.now();
      if (status !== "active") state = "disabled";
      if (typeof remaining === "number" && remaining <= 0.000001)
        state = "used";
      if (expiresAtIso && new Date(expiresAtIso).getTime() <= now)
        state = "expired";

      return NextResponse.json({
        kind: "coupon",
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
    }

    // 2) Buscar en `percentage_discounts`
    const snapPercent = await adminDb
      .collection("percentage_discounts")
      .where("code", "==", code)
      .limit(1)
      .get();

    if (!snapPercent.empty) {
      const doc = snapPercent.docs[0];
      const data: any = doc.data();

      const percent = Number(data?.percent ?? 0); // entero 1..100
      const used = !!data?.used;
      const expiresAt = data?.expiresAt || ""; // YYYY-MM-DD
      const now = Date.now();
      let state: "active" | "expired" | "used" | "disabled" = "active";

      if (used) state = "used";
      if (expiresAt) {
        const expTime = new Date(expiresAt + "T23:59:59").getTime();
        if (expTime <= now) state = "expired";
      }

      return NextResponse.json({
        kind: "percent",
        percentDoc: {
          id: doc.id,
          code: data.code,
          percent,
          expiresAt,
          used,
        },
        state,
      });
    }

    // nada encontrado
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (e: any) {
    console.error("coupon lookup error:", e);
    return NextResponse.json(
      { error: e?.message ?? "server_error" },
      { status: 500 }
    );
  }
}
