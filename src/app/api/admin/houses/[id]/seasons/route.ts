import { NextResponse, NextRequest } from "next/server";
import admin from "@/lib/firebase-admin";
import { cookies } from "next/headers";

type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const VALID_WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

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

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function genSeasonId() {
  return `season-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user)
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { id } = await context.params;

    // NOTE: id in body is ignored on purpose — server always generates an id.
    // Required body fields: name, start, end, weekdayPrices (optional object)
    const seasonId = genSeasonId();
    const name = body.name ? String(body.name).trim() : "";
    const start = body.start ? String(body.start).trim() : "";
    const end = body.end ? String(body.end).trim() : "";
    const weekdayPrices =
      body.weekdayPrices && typeof body.weekdayPrices === "object"
        ? body.weekdayPrices
        : undefined;

    // Mandatory validations
    if (!name) {
      return NextResponse.json(
        { error: "Missing season name (name is required)" },
        { status: 400 }
      );
    }
    if (!start || !isIsoDate(start)) {
      return NextResponse.json(
        { error: "Missing or invalid start date (YYYY-MM-DD required)" },
        { status: 400 }
      );
    }
    if (!end || !isIsoDate(end)) {
      return NextResponse.json(
        { error: "Missing or invalid end date (YYYY-MM-DD required)" },
        { status: 400 }
      );
    }
    if (new Date(end).getTime() < new Date(start).getTime()) {
      return NextResponse.json(
        { error: "end must be >= start" },
        { status: 400 }
      );
    }

    // validate weekdayPrices (if provided)
    const cleanWeekday: Record<string, number> = {};
    if (weekdayPrices) {
      for (const k of Object.keys(weekdayPrices)) {
        if (!VALID_WEEKDAYS.includes(k as Weekday)) {
          return NextResponse.json(
            { error: `Invalid weekday key: ${k}` },
            { status: 400 }
          );
        }
        const n = Number((weekdayPrices as any)[k]);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json(
            { error: `Invalid price for ${k}` },
            { status: 400 }
          );
        }
        cleanWeekday[k] = n;
      }
    }

    const db = admin.firestore();
    const ref = db.collection("houses").doc(id);
    const snap = await ref.get();
    if (!snap.exists)
      return NextResponse.json(
        { error: "Casa no encontrada." },
        { status: 404 }
      );

    // Build season entry — start/end are mandatory (no standard/defaultPrice)
    const entry: any = {
      id: seasonId,
      name,
      start,
      end,
    };
    if (Object.keys(cleanWeekday).length) entry.weekdayPrices = cleanWeekday;

    const updates: any = {};
    updates[`seasons.${seasonId}`] = entry;

    await ref.update(updates);

    // return updated doc (shallow)
    const updated = await ref.get();
    const data = updated.data() || {};
    const payload = {
      id: updated.id,
      alias: data.alias || "",
      name: data.name || "",
      type: data.type ?? null,
      maxGuests: data.maxGuests ?? null,
      images: Array.isArray(data.images) ? data.images : [],
      pricePerNight:
        typeof data.pricePerNight === "object" && data.pricePerNight
          ? data.pricePerNight
          : {},
      specialPrices:
        typeof data.specialPrices === "object" && data.specialPrices
          ? data.specialPrices
          : {},
      seasons:
        typeof data.seasons === "object" && data.seasons ? data.seasons : {},
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    console.error("[api/admin/houses/[id]/seasons POST] error:", e);
    return NextResponse.json(
      { error: e?.message || "Update error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin();
    if (!user)
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { id } = await context.params;
    const seasonId = String(body.id || "").trim();
    if (!seasonId)
      return NextResponse.json({ error: "Missing season id" }, { status: 400 });

    const db = admin.firestore();
    const ref = db.collection("houses").doc(id);
    const snap = await ref.get();
    if (!snap.exists)
      return NextResponse.json(
        { error: "Casa no encontrada." },
        { status: 404 }
      );

    // delete seasons.<seasonId>
    const updates: any = {};
    updates[`seasons.${seasonId}`] = admin.firestore.FieldValue.delete();
    await ref.update(updates);

    const updated = await ref.get();
    const data = updated.data() || {};
    const payload = {
      id: updated.id,
      alias: data.alias || "",
      name: data.name || "",
      type: data.type ?? null,
      maxGuests: data.maxGuests ?? null,
      images: Array.isArray(data.images) ? data.images : [],
      pricePerNight:
        typeof data.pricePerNight === "object" && data.pricePerNight
          ? data.pricePerNight
          : {},
      specialPrices:
        typeof data.specialPrices === "object" && data.specialPrices
          ? data.specialPrices
          : {},
      seasons:
        typeof data.seasons === "object" && data.seasons ? data.seasons : {},
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    console.error("[api/admin/houses/[id]/seasons DELETE] error:", e);
    return NextResponse.json(
      { error: e?.message || "Delete error" },
      { status: 500 }
    );
  }
}
