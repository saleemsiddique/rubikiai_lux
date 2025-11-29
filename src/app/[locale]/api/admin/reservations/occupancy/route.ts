// app/api/admin/reservations/occupancy/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import admin, { adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
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

  try {
    const url = new URL(req.url);
    const start = url.searchParams.get("start") || undefined;
    const end = url.searchParams.get("end") || undefined;
    const houseId = url.searchParams.get("houseId") || undefined;

    if (!start || !end || start >= end) {
      return Response.json({ error: "Invalid start/end" }, { status: 400 });
    }

    let q: FirebaseFirestore.Query = adminDb.collection("reservations");
    if (houseId) q = q.where("houseId", "==", houseId);
    q = q.where("checkIn", "<=", end).orderBy("checkIn", "asc");

    console.log("[occupancy] start:", start, "end:", end, "houseId:", houseId);

    const t0 = Date.now();
    const snap = await q.get().catch((e: any) => {
      const code = e?.code || e?.errorInfo?.code || "unknown";
      const msg = e?.message || e?.errorInfo?.message || String(e);
      console.error("[occupancy] Firestore error:", code, msg);
      throw new Error(msg);
    });
    const t1 = Date.now();
    console.log(`[occupancy] fetched ${snap.size} docs in ${t1 - t0}ms`);

    const rows = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter((r: any) => overlaps(r.checkIn, r.checkOut, start, end));

    return Response.json({ results: rows });
  } catch (e: any) {
    console.error("[admin/reservations/occupancy] error:", e?.message || e);
    return Response.json({ error: e?.message || "Occupancy error" }, { status: 400 });
  }
}
