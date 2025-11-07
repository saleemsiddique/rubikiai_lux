// app/api/houses/lookup/route.ts
import { NextResponse } from "next/server";
import admin from "@/lib/firebase-admin";

type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

type Season = {
  name: string;
  start: string; // YYYY-MM-DD (normalized)
  end: string;   // YYYY-MM-DD (normalized)
  weekdayPrices: Partial<Record<Weekday, number>>;
};

function cleanPricePerNight(raw: unknown): Partial<Record<Weekday, number>> {
  const out: Partial<Record<Weekday, number>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!WEEKDAYS.includes(k as Weekday)) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) continue;
    out[k as Weekday] = n;
  }
  return out;
}

function cleanSpecialPrices(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;

  const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ISO_RE.test(k)) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) continue;
    out[k] = n;
  }
  return out;
}

/**
 * Normaliza una fecha que puede venir como:
 * - "YYYY-MM-DD" (ISO) -> se devuelve igual
 * - "DD/MM/YYYY" -> se convierte a "YYYY-MM-DD"
 * - cualquier otra cosa -> null
 */
function normalizeDateToISO(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (isoRe.test(s)) return s;
  const dmyRe = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const m = s.match(dmyRe);
  if (m) {
    // dmy -> yyyy-mm-dd
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

/**
 * Limpia y normaliza temporadas. Acepta:
 * - un array de objetos [{ name, start, end, weekdayPrices }, ...]
 * - un objeto/map { key1: { ... }, key2: { ... } }
 *
 * Devuelve Season[] con fechas en YYYY-MM-DD y weekdayPrices numéricos.
 */
function cleanSeasons(raw: unknown): Season[] {
  const out: Season[] = [];
  if (!raw) return out;

  // helper to validate & push a season-like object
  const tryPush = (seasonLike: any) => {
    if (!seasonLike || typeof seasonLike !== "object") return;
    const name = typeof seasonLike.name === "string" ? seasonLike.name.trim() : "";
    const startIso = normalizeDateToISO(seasonLike.start);
    const endIso = normalizeDateToISO(seasonLike.end);
    if (!name || !startIso || !endIso) return;

    const weekdayPrices: Partial<Record<Weekday, number>> = cleanPricePerNight(
      seasonLike.weekdayPrices
    );

    out.push({
      name,
      start: startIso,
      end: endIso,
      weekdayPrices,
    });
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      tryPush(item);
    }
    return out;
  }

  if (typeof raw === "object") {
    for (const [, value] of Object.entries(raw as Record<string, unknown>)) {
      tryPush(value);
    }
    return out;
  }

  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) {
      return NextResponse.json(
        { error: "Parámetro 'q' requerido (id o alias)." },
        { status: 400 }
      );
    }

    const db = admin.firestore();

    // 1) Intento por ID
    let snap = await db.collection("houses").doc(q).get();

    // 2) Si no existe, por alias exacto
    if (!snap.exists) {
      const byAlias = await db
        .collection("houses")
        .where("alias", "==", q)
        .limit(1)
        .get();
      if (byAlias.empty) {
        return NextResponse.json(
          { error: "Casa no encontrada." },
          { status: 404 }
        );
      }
      snap = byAlias.docs[0];
    }

    const data = snap.data() || {};

    const payload = {
      id: snap.id,
      alias: data.alias || "",
      name: data.name || "",
      type: data.type ?? null,
      maxGuests: data.maxGuests ?? null,
      images: Array.isArray(data.images) ? data.images : [],
      pricePerNight: cleanPricePerNight(data.pricePerNight),
      specialPrices: cleanSpecialPrices(data.specialPrices),
      seasons: cleanSeasons(data.seasons), // ahora devuelve Season[]
    };

    // Evita cachear en el panel
    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    console.error("[api/houses/lookup] error:", e);
    return NextResponse.json(
      { error: e?.message || "Lookup error" },
      { status: 500 }
    );
  }
}
