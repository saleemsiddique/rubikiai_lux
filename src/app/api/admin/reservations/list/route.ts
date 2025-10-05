// app/api/admin/reservations/list/route.ts
export const runtime = "nodejs";           // explícito
export const dynamic = "force-dynamic";    // sin caché en edge

import admin, { adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

type Reservation = {
  id: string;
  checkIn: string;  // "YYYY-MM-DD"
  checkOut: string; // "YYYY-MM-DD"
  status?: string;
  houseId?: string;
  houseIds?: string[];
  customerEmail?: string;
  guests?: number;
  total?: number;
  discountedTotal?: number;
  firstNightCharge?: number;
  createdAt?: any;
  paidAt?: any;
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
    const decoded = await admin.auth().verifySessionCookie(session, true);
    if ((decoded as any)?.admin) return decoded;
    return null;
  } catch {
    return null;
  }
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

    // Si se piden estados concretos y la lista es pequeña (<=10), usa "in" para reducir
    if (statuses && statuses.length > 0 && statuses.length <= 10) {
      q = q.where("status", "in", statuses);
    }

    // Reducimos por checkIn <= end (si hay end). El solapado final se filtra server-side.
    if (end) {
      q = q.where("checkIn", "<=", end);
    }

    q = q.orderBy("checkIn", order as any).limit(limitParam);

    // Logs de depuración (se ven en server logs)
    console.log("[reservations/list] houseId:", houseId, "start:", start, "end:", end, "statuses:", statuses);

    const t0 = Date.now();
    const snap = await q.get().catch((e: any) => {
      // Si Firestore pide índice, extrae el mensaje completo (suele traer URL para crearlo)
      const code = e?.code || e?.errorInfo?.code || "unknown";
      const msg = e?.message || e?.errorInfo?.message || String(e);
      console.error("[reservations/list] Firestore error:", code, msg);
      throw new Error(msg);
    });
    const t1 = Date.now();
    console.log(`[reservations/list] fetched ${snap.size} docs in ${t1 - t0}ms`);

    let rows: Reservation[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    // Filtro de solapamiento en servidor (checkOut > start)
    if (start) {
      rows = rows.filter(r => overlaps(String(r.checkIn), String(r.checkOut), start, end || "9999-12-31"));
    }

    // Si NO pudimos usar "in" arriba (por ser >10), aplica filtro aquí
    if (statuses && statuses.length > 10) {
      rows = rows.filter(r => statuses.includes(String(r.status || "")));
    }

    return Response.json({ results: rows });
  } catch (e: any) {
    console.error("[admin/reservations/list] error:", e?.message || e);
    // Devuelve el texto completo para que lo veas en el cliente (incluye link de índice si Firestore lo da)
    return Response.json({ error: e?.message || "List error" }, { status: 400 });
  }
}
