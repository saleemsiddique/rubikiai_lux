// app/api/admin/reservations/[id]/status/route.ts
import admin, { adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { nowInLithuania } from "@/app/[locale]/utils/date-server";

// 🔄 estados válidos ahora
const ALLOWED = new Set([
  "reserved", // reserva confirmada (pago de entrada hecho)
  "admin",    // bloqueo manual interno
  "complete", // estancia finalizada / cobro final completado
  "canceled", // cancelada
]);

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;
  try {
    const decoded = await admin.auth().verifySessionCookie(session, false);
    if ((decoded as any)?.admin) return decoded;
    return null;
  } catch {
    return null;
  }
}

function toISOIfTimestamp(val: any) {
  if (!val) return null;
  if (typeof val?.toDate === "function") return val.toDate().toISOString();
  if (typeof val === "string") return val;
  return null;
}

function normalizeSnap(snap: FirebaseFirestore.DocumentSnapshot) {
  const raw = snap.data() as any;
  if (!raw) return { id: snap.id, ...(raw || {}) };
  const out: any = { id: snap.id, ...raw };

  out.createdAt = toISOIfTimestamp(raw?.createdAt);
  out.paidAt = toISOIfTimestamp(raw?.paidAt);
  out.deductedAt = toISOIfTimestamp(raw?.deductedAt);
  out.updatedAt = toISOIfTimestamp(raw?.updatedAt);

  out.checkIn = raw?.checkIn ? String(raw.checkIn) : null;
  out.checkOut = raw?.checkOut ? String(raw.checkOut) : null;

  out.customer = raw?.customer ?? null;
  out.customerEmail = raw?.customerEmail ?? raw?.email ?? null;
  out.email = raw?.email ?? null;
  out.name = raw?.name ?? (raw?.customer?.name ?? null);
  out.phone = raw?.phone ?? (raw?.customer?.phone ?? null);
  out.userId = raw?.userId ?? (raw?.customer?.userId ?? null);
  out.arrivalTime = raw?.arrivalTime ?? (raw?.customer?.arrivalTime ?? null);
  out.comment = raw?.comment ?? (raw?.customer?.comment ?? null);

  out.guests = Number(raw?.guests ?? 0);
  
  // ✅ Campos simplificados (NUEVOS)
  out.payNow = Number(raw?.payNow ?? raw?.discountedFirst ?? 0);
  out.payAtArrival = Number(raw?.payAtArrival ?? 0);
  out.totalStay = Number(raw?.totalStay ?? raw?.discountedGrandTotal ?? raw?.grandTotal ?? 0);
  
  // Legacy fields (mantener para compatibilidad)
  out.total = Number(raw?.total ?? raw?.grandTotal ?? 0);
  out.firstNightCharge = Number(raw?.firstNightCharge ?? 0);
  out.discountedFirst = Number(raw?.discountedFirst ?? 0);
  out.discountedTotal = Number(raw?.discountedTotal ?? raw?.discountedGrandTotal ?? 0);
  out.amountApplied = Number(raw?.amountApplied ?? 0);
  out.totalNightsOnly = Number(raw?.totalNightsOnly ?? out.total);
  out.includedBase = Number(raw?.includedBase ?? 2);
  out.extraGuests = Number(raw?.extraGuests ?? Math.max(0, out.guests - out.includedBase));
  
  // ✅ Jacuzzi con days
  out.jacuzzi = raw?.jacuzzi ?? { 
    enabled: false, 
    fee: Number(raw?.jacuzziFee ?? 0),
    days: Number(raw?.jacuzzi?.days ?? 0)
  };
  out.jacuzziFee = Number(raw?.jacuzziFee ?? out.jacuzzi?.fee ?? 0);
  out.grandTotal = Number(raw?.grandTotal ?? out.total);
  out.discountedGrandTotal = Number(raw?.discountedGrandTotal ?? out.discountedTotal ?? out.grandTotal);

  out.coupon = raw?.coupon ?? null;
  out.code = raw?.code ?? (out.coupon?.code ?? null);
  out.percentDiscount = raw?.percentDiscount ?? null;

  return out;
}

// ctx.params viene como Promise<{ id: string }>
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const me = await requireAdmin();
  if (!me)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { status, paidInFull, note } = await req.json();

    if (!status || !ALLOWED.has(String(status))) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const params = await ctx.params;
    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "missing_id" },
        { status: 400 }
      );
    }

    const ref = adminDb.collection("reservations").doc(id);

    const data: any = {
      status: String(status),
      updatedAt: nowInLithuania(),
    };

    // si marcamos "complete" o paidInFull, dejamos constancia de que está pagado
    if (paidInFull === true || status === "complete") {
      data.paidInFull = true;
      data.paidAt = nowInLithuania();
    }

    if (typeof note === "string" && note.trim()) {
      data.adminNote = note.trim();
    }

    await ref.update(data);
    const snap = await ref.get();
    const normalized = normalizeSnap(snap);

    return NextResponse.json({
      ok: true,
      reservation: normalized,
    });
  } catch (e: any) {
    console.error("[admin/reservations/status] error:", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Update error" },
      { status: 400 }
    );
  }
}