// app/api/admin/houses/[id]/seasons/migrate/route.ts
import { NextResponse, NextRequest } from "next/server";
import admin from "@/lib/firebase-admin";
import { cookies } from "next/headers";

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;
  try {
    const decoded = await admin.auth().verifySessionCookie(session, true);
    if (!(decoded as any).admin) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const force = !!body.force;

    const db = admin.firestore();
    const ref = db.collection("houses").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Casa no encontrada." }, { status: 404 });

    const data: any = snap.data() || {};
    const pricePerNight = data.pricePerNight || {};
    // check if there's already a standard season (no start/end)
    const seasons = data.seasons || {};
    const hasStandard = Object.values(seasons).some((s: any) => !s.start && !s.end);

    if (hasStandard && !force) {
      return NextResponse.json({ error: "Standard season already exists. Use { force: true } to overwrite." }, { status: 400 });
    }

    const standardId = body.id?.trim() || "standard";
    const entry: any = {
      id: standardId,
      name: body.name?.trim() || "Standard",
      weekdayPrices: pricePerNight,
    };

    const updates: any = {};
    updates[`seasons.${standardId}`] = entry;

    await ref.update(updates);

    const updated = await ref.get();
    const payload = {
      id: updated.id,
      alias: updated.data()?.alias || "",
      name: updated.data()?.name || "",
      type: updated.data()?.type ?? null,
      maxGuests: updated.data()?.maxGuests ?? null,
      images: Array.isArray(updated.data()?.images) ? updated.data()?.images : [],
      pricePerNight: typeof updated.data()?.pricePerNight === "object" && updated.data()?.pricePerNight ? updated.data()?.pricePerNight : {},
      specialPrices: typeof updated.data()?.specialPrices === "object" && updated.data()?.specialPrices ? updated.data()?.specialPrices : {},
      seasons: typeof updated.data()?.seasons === "object" && updated.data()?.seasons ? updated.data()?.seasons : {},
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    console.error("[migrate standard] error:", e);
    return NextResponse.json({ error: e?.message || "Migration error" }, { status: 500 });
  }
}
