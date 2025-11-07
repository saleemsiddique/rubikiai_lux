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

/**
 * Normaliza specialPrices a la forma:
 * {
 *   singleDays: { "YYYY-MM-DD": number, ... },
 *   ranges: [ { start, end, price }, ... ]
 * }
 *
 * Soporta:
 *  - legacy plano: { "2025-12-24": 220, ... }
 *  - nuevo: { singleDays: {...}, ranges: [{start,end,price}, ...] }
 */
function normalizeSpecialPrices(raw: unknown) {
  const out: {
    singleDays: Record<string, number>;
    ranges: Array<{ start: string; end: string; price: number }>;
  } = { singleDays: {}, ranges: [] };

  if (!raw) return out;

  // Caso legacy: objeto plano YYYY-MM-DD -> number
  if (typeof raw === "object" && !Array.isArray(raw) && !(raw as any).singleDays && !(raw as any).ranges) {
    const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!ISO_RE.test(k)) continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) continue;
      out.singleDays[k] = n;
    }
    return out;
  }

  // Caso nuevo: intentar leer singleDays y ranges
  if (typeof raw === "object" && (raw as any)) {
    const obj = raw as any;
    if (obj.singleDays && typeof obj.singleDays === "object") {
      const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
      for (const [k, v] of Object.entries(obj.singleDays)) {
        if (!ISO_RE.test(k)) continue;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) continue;
        out.singleDays[k] = n;
      }
    }
    if (Array.isArray(obj.ranges)) {
      for (const r of obj.ranges) {
        if (
          r &&
          typeof r.start === "string" &&
          typeof r.end === "string" &&
          typeof r.price === "number" &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.start) &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.end) &&
          r.price >= 0
        ) {
          out.ranges.push({ start: r.start, end: r.end, price: r.price });
        }
      }
    }
  }

  return out;
}

/** Limpia/normaliza seasons (mapa en Firestore) */
function cleanSeasons(raw: unknown) {
  const out: Record<
    string,
    {
      id: string;
      name: string;
      start: string;
      end: string;
      weekdayPrices?: Partial<Record<Weekday, number>>;
    }
  > = {};

  if (!raw || typeof raw !== "object") return out;

  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const id = typeof (v as any).id === "string" ? (v as any).id : String(k);
    const name = typeof (v as any).name === "string" ? (v as any).name : "";
    const start = typeof (v as any).start === "string" ? (v as any).start : "";
    const end = typeof (v as any).end === "string" ? (v as any).end : "";
    // Validar fechas simples YYYY-MM-DD
    const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (!name || !ISO_RE.test(start) || !ISO_RE.test(end)) continue;
    // weekdayPrices opcional
    const wpRaw = (v as any).weekdayPrices;
    const wp = cleanPricePerNight(wpRaw);
    const entry: any = { id, name, start, end };
    if (Object.keys(wp).length) entry.weekdayPrices = wp;
    out[id] = entry;
  }

  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) {
      return NextResponse.json({ error: "Parámetro 'q' requerido (id o alias)." }, { status: 400 });
    }

    const db = admin.firestore();

    // 1) Intento por ID
    let snap = await db.collection("houses").doc(q).get();

    // 2) Si no existe, por alias exacto
    if (!snap.exists) {
      const byAlias = await db.collection("houses").where("alias", "==", q).limit(1).get();
      if (byAlias.empty) {
        return NextResponse.json({ error: "Casa no encontrada." }, { status: 404 });
      }
      snap = byAlias.docs[0];
    }

    const data = snap.data() || {};

    const payload = {
      id: snap.id,
      alias: data.alias || "",
      name: data.name || "",
      type: data.type ?? null,
      maxGuests: typeof data.maxGuests === "number" ? data.maxGuests : null,
      includedGuests: typeof data.includedGuests === "number" ? data.includedGuests : 2,
      images: Array.isArray(data.images) ? data.images : [],
      pricePerNight: cleanPricePerNight(data.pricePerNight),
      // specialPrices normalizado (soporta legacy y nuevo formato)
      specialPrices: normalizeSpecialPrices(data.specialPrices ?? {}),
      // seasons saneadas (solo las bien formadas)
      seasons: cleanSeasons(data.seasons ?? {}),
    };

    // Evita cachear en el panel
    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    console.error("[api/houses/lookup] error:", e);
    return NextResponse.json({ error: e?.message || "Lookup error" }, { status: 500 });
  }
}
