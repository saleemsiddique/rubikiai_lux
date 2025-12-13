// app/api/admin/reservations/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import admin, { adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

type Reservation = {
  id: string;
  checkIn: string;  // "YYYY-MM-DD"
  checkOut: string; // "YYYY-MM-DD"
  status?: string;
  houseId?: string;
  houseIds?: string[];
  customer?: any;
  customerEmail?: string;
  email?: string;
  name?: string;
  phone?: string;
  guests?: number;
  
  // ✅ Campos simplificados (NUEVOS)
  payNow?: number;
  payAtArrival?: number;
  totalStay?: number;
  
  // Legacy fields
  total?: number;
  discountedTotal?: number;
  firstNightCharge?: number;
  discountedFirst?: number;
  createdAt?: string | null;
  paidAt?: string | null;
  deductedAt?: string | null;
  grandTotal?: number;
  discountedGrandTotal?: number;
  amountApplied?: number;
  coupon?: any;
  code?: string;
  percentDiscount?: any;
  totalNightsOnly?: number;
  jacuzzi?: any;
  jacuzziFee?: number;
  includedBase?: number;
  extraGuests?: number;
  [k: string]: any;
};

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  // checkOut es EXCLUSIVA
  return aStart < bEnd && aEnd > bStart;
}

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

function normalizeDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): Reservation {
  const raw = doc.data() as any;
  const out: any = { id: doc.id, ...raw };

  // timestamps
  out.createdAt = toISOIfTimestamp(raw?.createdAt);
  out.paidAt = toISOIfTimestamp(raw?.paidAt);
  out.deductedAt = toISOIfTimestamp(raw?.deductedAt);
  out.updatedAt = toISOIfTimestamp(raw?.updatedAt);

  // checkIn/checkOut
  out.checkIn = raw?.checkIn ? String(raw.checkIn) : null;
  out.checkOut = raw?.checkOut ? String(raw.checkOut) : null;

  // customer fields
  out.customer = raw?.customer ?? null;
  out.customerEmail = raw?.customerEmail ?? raw?.email ?? null;
  out.email = raw?.email ?? null;
  out.name = raw?.name ?? (raw?.customer?.name ?? null);
  out.phone = raw?.phone ?? (raw?.customer?.phone ?? null);
  out.userId = raw?.userId ?? (raw?.customer?.userId ?? null);
  out.arrivalTime = raw?.arrivalTime ?? (raw?.customer?.arrivalTime ?? null);
  out.comment = raw?.comment ?? (raw?.customer?.comment ?? null);

  // numeric / price fields (sane defaults)
  out.guests = Number(raw?.guests ?? 0);
  
  // ✅ CAMPOS SIMPLIFICADOS (NUEVOS) - con fallback a legacy
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

  // coupon / code / percentDiscount
  out.coupon = raw?.coupon ?? null;
  out.code = raw?.code ?? (out.coupon?.code ?? null);
  out.percentDiscount = raw?.percentDiscount ?? null;

  return out;
}

export async function GET(req: Request) {
  const me = await requireAdmin();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status"); // coma separada
  const houseId = url.searchParams.get("houseId") || undefined;
  const start = url.searchParams.get("start") || undefined; // "YYYY-MM-DD"
  const end = url.searchParams.get("end") || undefined;     // "YYYY-MM-DD"
  const limitParam = Math.min(2000, Number(url.searchParams.get("limit") || 500));
  const order = (url.searchParams.get("order") || "asc").toLowerCase() === "desc" ? "desc" : "asc";

  const statuses = statusParam ? statusParam.split(",").map(s => s.trim()).filter(Boolean) : undefined;

  try {
    let q: FirebaseFirestore.Query = adminDb.collection("reservations");

    if (houseId) {
      q = q.where("houseId", "==", houseId);
    }

    if (statuses && statuses.length > 0 && statuses.length <= 10) {
      q = q.where("status", "in", statuses);
    }

    if (end) {
      q = q.where("checkIn", "<=", end);
    }

    q = q.orderBy("checkIn", order as any).limit(limitParam);

    console.log("[reservations/list] houseId:", houseId, "start:", start, "end:", end, "statuses:", statuses);

    const t0 = Date.now();
    const snap = await q.get().catch((e: any) => {
      const code = e?.code || e?.errorInfo?.code || "unknown";
      const msg = e?.message || e?.errorInfo?.message || String(e);
      console.error("[reservations/list] Firestore error:", code, msg);
      throw new Error(msg);
    });
    const t1 = Date.now();
    console.log(`[reservations/list] fetched ${snap.size} docs in ${t1 - t0}ms`);

    let rows: Reservation[] = snap.docs.map(d => normalizeDoc(d));

    // Filtro por checkIn dentro del rango (como admin/revenue)
    if (start) {
      rows = rows.filter(r => {
        const checkIn = String(r.checkIn);
        return checkIn >= start && checkIn <= (end || "9999-12-31");
      });
    }

    // Si NO pudimos usar "in" arriba (por ser >10), aplica filtro aquí
    if (statuses && statuses.length > 10) {
      rows = rows.filter(r => statuses.includes(String(r.status || "")));
    }

    return Response.json({ results: rows });
  } catch (e: any) {
    console.error("[admin/reservations/list] error:", e?.message || e);
    return Response.json({ error: e?.message || "List error" }, { status: 400 });
  }
}