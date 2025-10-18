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
    const { checkIn, checkOut, houseId, houseIds, note, guests } = body || {};
    const guestsNum = Math.max(1, Number(guests || 2)); // ← NUEVO (mínimo 1)

    if (!isISO(checkIn) || !isISO(checkOut) || checkIn >= checkOut) {
      return Response.json({ error: "Invalid date range" }, { status: 400 });
    }

    // NUEVO: no permitir pasado (comparación por fecha, sin horas)
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (checkOut <= todayISO) {
      return Response.json({ error: "Cannot block past dates" }, { status: 400 });
    }

    let targetHouseIds: string[] = [];
    if (houseIds && Array.isArray(houseIds) && houseIds.length) {
      targetHouseIds = houseIds.map((x: any) => String(x));
    } else if (houseId) {
      targetHouseIds = [String(houseId)];
    } else {
      return Response.json({ error: "houseId or houseIds required" }, { status: 400 });
    }

    // NUEVO: comprobar solape con reservas existentes bloqueantes (reserved|complete|admin)
    // Regla de solape: [Astart, Aend) solapa [Bstart, Bend) si Astart < Bend && Bstart < Aend
    const blockingStatuses = ["reserved", "complete", "admin"];
    const reservationsRef = adminDb.collection("reservations");

    // Buscamos por cada houseId tanto en houseId== como en array-contains houseIds
    // (podrías optimizar con un query compuesto y OR; Firestore no tiene OR puro sin index compuesto,
    // por lo que hacemos 2 consultas por house y combinamos)
    const conflictPromises = targetHouseIds.map(async (hid) => {
      const q1 = await reservationsRef
        .where("houseId", "==", hid)
        .where("status", "in", blockingStatuses as any)
        .get();

      const q2 = await reservationsRef
        .where("houseIds", "array-contains", hid)
        .where("status", "in", blockingStatuses as any)
        .get();

      const docs = new Map<string, FirebaseFirestore.DocumentData>();
      q1.docs.forEach(d => docs.set(d.id, d.data()));
      q2.docs.forEach(d => docs.set(d.id, d.data()));

      // Chequeo de solape
      for (const data of docs.values()) {
        const rIn = String(data.checkIn);
        const rOut = String(data.checkOut);
        if (rIn < checkOut && checkIn < rOut) {
          return true; // hay conflicto
        }
      }
      return false;
    });

    const conflictsArray = await Promise.all(conflictPromises);
    if (conflictsArray.some(Boolean)) {
      return Response.json({ error: "Date range overlaps an existing reservation (reserved/complete/admin)" }, { status: 409 });
    }

    // === PRICING: usa el endpoint oficial para calcular precios ===
    const origin = new URL(req.url).origin;

    // Si bloqueas 1 o varias casas, pásalas como "houseId" unidas por "__" (tu /price lo soporta)
    const houseIdForPrice = targetHouseIds.join("__");

    const priceRes = await fetch(`${origin}/api/reservations/price`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        houseId: houseIdForPrice,
        startDate: checkIn,   // "YYYY-MM-DD"
        endDate: checkOut,    // "YYYY-MM-DD"
        guests: guestsNum,    // ← ver paso 3 más abajo
      }),
    });

    if (!priceRes.ok) {
      const txt = await priceRes.text().catch(() => "");
      return Response.json({ error: `Price API error: ${txt || priceRes.statusText}` }, { status: 422 });
    }

    const priceJson: any = await priceRes.json();
    if (priceJson?.error) {
      return Response.json({ error: `Price API: ${priceJson.error}` }, { status: 422 });
    }

    // Valores calculados por el endpoint de precio (fuente de verdad)
    const total = Number(priceJson.total ?? 0);
    const firstNight = Number(priceJson.first ?? 0);
    const nights = Number(priceJson.nights ?? 0);


    const payload: any = {
      status: "admin",
      createdBy: me.email || me.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      checkIn: String(checkIn),
      checkOut: String(checkOut),
      nights,
      adminNote: note || null,
      // PRECIOS REALES
      total,
      discountedTotal: total,   // si quieres, aquí podrías aplicar un descuento interno
      firstNightCharge: firstNight,
      currency: "EUR",
      guests: guestsNum,
      houseIds: targetHouseIds,
      houseId: targetHouseIds[0],
    };



    const ref = await adminDb.collection("reservations").add(payload);
    const snap = await ref.get();
    return Response.json({ ok: true, reservation: { id: snap.id, ...snap.data() } });
  } catch (e: any) {
    console.error("[admin/reservations/block] error:", e?.message || e);
    return Response.json({ error: e?.message || "Block error" }, { status: 400 });
  }
}

