// app/api/admin/reservations/[id]/status/route.ts
import admin, { adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

const ALLOWED = new Set(["complete", "canceled", "pending", "expired", "reserved", "admin"]);

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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await requireAdmin();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { status, paidInFull, note } = await req.json();
    if (!status || !ALLOWED.has(String(status))) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const ref = adminDb.collection("reservations").doc(params.id);
    const data: any = {
      status: String(status),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (paidInFull === true || status === "complete") {
      data.paidInFull = true;
      data.paidAt = admin.firestore.FieldValue.serverTimestamp();
    }
    if (typeof note === "string" && note.trim()) {
      data.adminNote = note.trim();
    }

    await ref.update(data);
    const snap = await ref.get();
    return Response.json({ ok: true, reservation: { id: snap.id, ...snap.data() } });
  } catch (e: any) {
    console.error("[admin/reservations/status] error:", e?.message || e);
    return Response.json({ error: e?.message || "Update error" }, { status: 400 });
  }
}
