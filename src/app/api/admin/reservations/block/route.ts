// app/api/admin/reservations/block/route.ts
import admin, { adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

function isISO(s: string) {
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}
function nightsBetween(a: string, b: string) {
  const A = new Date(a), B = new Date(b);
  const ms = B.getTime() - A.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
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

export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { checkIn, checkOut, houseId, houseIds, note } = body || {};

    if (!isISO(checkIn) || !isISO(checkOut) || checkIn >= checkOut) {
      return Response.json({ error: "Invalid date range" }, { status: 400 });
    }

    let payload: any = {
      status: "admin",
      createdBy: me.email || me.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      checkIn: String(checkIn),
      checkOut: String(checkOut),
      nights: nightsBetween(checkIn, checkOut),
      adminNote: note || null,
      total: 0,
      discountedTotal: 0,
      firstNightCharge: 0,
      currency: "EUR",
    };

    if (houseIds && Array.isArray(houseIds) && houseIds.length) {
      payload.houseIds = houseIds.map((x: any) => String(x));
      payload.houseId = payload.houseIds[0];
    } else if (houseId) {
      payload.houseId = String(houseId);
      payload.houseIds = [payload.houseId];
    } else {
      return Response.json({ error: "houseId or houseIds required" }, { status: 400 });
    }

    const ref = await adminDb.collection("reservations").add(payload);
    const snap = await ref.get();
    return Response.json({ ok: true, reservation: { id: snap.id, ...snap.data() } });
  } catch (e: any) {
    console.error("[admin/reservations/block] error:", e?.message || e);
    return Response.json({ error: e?.message || "Block error" }, { status: 400 });
  }
}
