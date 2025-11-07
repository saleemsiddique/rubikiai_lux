// app/api/admin/houses/[id]/seasons/route.ts
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
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
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

function cleanSeasons(raw: unknown): Season[] {
  if (!Array.isArray(raw)) return [];
  
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const out: Season[] = [];
  
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    
    const season = item as any;
    
    if (
      typeof season.name !== "string" ||
      typeof season.start !== "string" ||
      typeof season.end !== "string" ||
      !DATE_RE.test(season.start) ||
      !DATE_RE.test(season.end)
    ) {
      continue;
    }

    out.push({
      name: season.name,
      start: season.start,
      end: season.end,
      weekdayPrices: cleanPricePerNight(season.weekdayPrices),
    });
  }
  
  return out;
}

// POST: Crear o actualizar una temporada
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const houseId = params.id;
    const body = await req.json();

    const { seasonIndex, season } = body;

    // Validaciones
    if (!season || typeof season !== "object") {
      return NextResponse.json(
        { error: "season es requerido y debe ser un objeto." },
        { status: 400 }
      );
    }

    const { name, start, end, weekdayPrices } = season;

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "El campo 'name' es requerido." },
        { status: 400 }
      );
    }

    if (typeof start !== "string" || !DATE_RE.test(start)) {
      return NextResponse.json(
        { error: "El campo 'start' debe tener formato YYYY-MM-DD." },
        { status: 400 }
      );
    }

    if (typeof end !== "string" || !DATE_RE.test(end)) {
      return NextResponse.json(
        { error: "El campo 'end' debe tener formato YYYY-MM-DD." },
        { status: 400 }
      );
    }

    // Limpiar precios
    const cleanedWeekdayPrices = cleanPricePerNight(weekdayPrices);

    const db = admin.firestore();
    const docRef = db.collection("houses").doc(houseId);

    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Casa no encontrada." },
        { status: 404 }
      );
    }

    const data = snap.data() || {};
    const seasons: Season[] = cleanSeasons(data.seasons);

    const newSeason: Season = {
      name: name.trim(),
      start,
      end,
      weekdayPrices: cleanedWeekdayPrices,
    };

    // Si seasonIndex es un número, actualizamos; si no, creamos nueva
    if (typeof seasonIndex === "number" && seasonIndex >= 0 && seasonIndex < seasons.length) {
      seasons[seasonIndex] = newSeason;
    } else {
      seasons.push(newSeason);
    }

    await docRef.update({ seasons });

    // Devolver la casa actualizada
    const updated = await docRef.get();
    const updatedData = updated.data() || {};

    const payload = {
      id: updated.id,
      alias: updatedData.alias || "",
      name: updatedData.name || "",
      type: updatedData.type ?? null,
      maxGuests: updatedData.maxGuests ?? null,
      images: Array.isArray(updatedData.images) ? updatedData.images : [],
      pricePerNight: cleanPricePerNight(updatedData.pricePerNight),
      specialPrices: cleanSpecialPrices(updatedData.specialPrices),
      seasons: cleanSeasons(updatedData.seasons),
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    console.error("[api/admin/houses/seasons] POST error:", e);
    return NextResponse.json(
      { error: e?.message || "Error al guardar temporada." },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar una temporada
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const houseId = params.id;
    const body = await req.json();

    const { seasonIndex } = body;

    if (typeof seasonIndex !== "number" || seasonIndex < 0) {
      return NextResponse.json(
        { error: "seasonIndex debe ser un número válido." },
        { status: 400 }
      );
    }

    const db = admin.firestore();
    const docRef = db.collection("houses").doc(houseId);

    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Casa no encontrada." },
        { status: 404 }
      );
    }

    const data = snap.data() || {};
    const seasons: Season[] = cleanSeasons(data.seasons);

    if (seasonIndex >= seasons.length) {
      return NextResponse.json(
        { error: "Índice de temporada inválido." },
        { status: 400 }
      );
    }

    // Eliminar la temporada del array
    seasons.splice(seasonIndex, 1);

    await docRef.update({ seasons });

    // Devolver la casa actualizada
    const updated = await docRef.get();
    const updatedData = updated.data() || {};

    const payload = {
      id: updated.id,
      alias: updatedData.alias || "",
      name: updatedData.name || "",
      type: updatedData.type ?? null,
      maxGuests: updatedData.maxGuests ?? null,
      images: Array.isArray(updatedData.images) ? updatedData.images : [],
      pricePerNight: cleanPricePerNight(updatedData.pricePerNight),
      specialPrices: cleanSpecialPrices(updatedData.specialPrices),
      seasons: cleanSeasons(updatedData.seasons),
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    console.error("[api/admin/houses/seasons] DELETE error:", e);
    return NextResponse.json(
      { error: e?.message || "Error al eliminar temporada." },
      { status: 500 }
    );
  }
}