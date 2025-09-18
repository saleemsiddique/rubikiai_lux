// app/api/reservations/list/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const snap = await adminDb.collection("reservations").get();
    const reservations = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ reservations });
  } catch (err) {
    console.error("reservations/list error:", err);
    return NextResponse.json({ error: "Failed to fetch reservations" }, { status: 500 });
  }
}
