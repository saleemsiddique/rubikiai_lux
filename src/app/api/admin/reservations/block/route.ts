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

function toISOIfTimestamp(val: any) {
  if (!val) return null;
  if (typeof val?.toDate === "function") return val.toDate().toISOString();
  if (typeof val === "string") return val;
  return null;
}

export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      checkIn,
      checkOut,
      houseId,
      houseIds,
      note,
      guests,
      // NUEVO: customer object esperado opcionalmente
      customer,
      // Opcionales: coupon/code/amountApplied (si quieres pre-aplicarlos)
      coupon,
      amountApplied,
      code,
      arrivalTime,
      comment,
      userId,
    } = body || {};

    const guestsNum = Math.max(1, Number(guests || 2)); // ← mínimo 1

    if (!isISO(checkIn) || !isISO(checkOut) || checkIn >= checkOut) {
      return Response.json({ error: "Invalid date range" }, { status: 400 });
    }

    // No permitir bloqueo en el pasado (comparando fechas, sin horas)
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

    // Comprobar solape con reservas bloqueantes (reserved|complete|admin)
    const blockingStatuses = ["reserved", "complete", "admin"];
    const reservationsRef = adminDb.collection("reservations");

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
    const houseIdForPrice = targetHouseIds.join("__");

    const priceRes = await fetch(`${origin}/api/reservations/price`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        houseId: houseIdForPrice,
        startDate: checkIn,
        endDate: checkOut,
        guests: guestsNum,
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

    // ✅ Valores calculados por el endpoint de precio (fuente de verdad)
    const total = Number(priceJson.total ?? 0);
    const firstNight = Number(priceJson.first ?? 0);
    const nights = Number(priceJson.nights ?? nightsBetween(checkIn, checkOut));
    const includedBase = Number(priceJson.includedBase ?? 2);
    const grandTotal = Number(priceJson.grandTotal ?? total);
    const discountedGrandTotal = Number(priceJson.discountedGrandTotal ?? priceJson.discountedTotal ?? total);
    const amountAppliedFromPrice = Number(priceJson.amountApplied ?? 0);
    const couponFromPrice = priceJson.coupon ?? null;
    const codeFromPrice = couponFromPrice?.code ?? priceJson.code ?? null;
    const totalNightsOnly = Number(priceJson.totalNightsOnly ?? total);
    
    // ✅ Jacuzzi con days
    const jacuzziInfo = priceJson.jacuzzi ?? { 
      enabled: false, 
      fee: Number(priceJson.jacuzziFee ?? 0),
      days: 0
    };
    
    const discountedFirst = Number(priceJson.discountedFirst ?? 0);
    const currency = priceJson.currency ?? "EUR";

    // ✅ Campos simplificados
    const payNow = Number(priceJson.payNow ?? discountedFirst);
    const totalStay = Number(priceJson.totalStay ?? discountedGrandTotal);
    const payAtArrival = Number(priceJson.payAtArrival ?? Math.max(0, totalStay - payNow));

    // Si viene customer en body, úsalo, si no, construye desde campos sueltos
    const customerObj: any = customer && typeof customer === "object"
      ? {
          name: customer.name ? String(customer.name) : null,
          email: customer.email ? String(customer.email) : null,
          phone: customer.phone ? String(customer.phone) : null,
          userId: customer.userId ? String(customer.userId) : null,
          arrivalTime: customer.arrivalTime ? String(customer.arrivalTime) : null,
          comment: customer.comment ? String(customer.comment) : null,
          // cualquier otro dato que quieras guardar
          ...customer,
        }
      : (body.email || body.name || body.phone || userId || arrivalTime || comment)
        ? {
            name: body.name ? String(body.name) : null,
            email: body.email ? String(body.email) : null,
            phone: body.phone ? String(body.phone) : null,
            userId: userId ? String(userId) : null,
            arrivalTime: arrivalTime ? String(arrivalTime) : null,
            comment: comment ? String(comment) : null,
          }
        : null;

    // Construimos el payload; escribimos customer y también los campos raíz para compatibilidad
    const payload: any = {
      status: "admin",
      createdBy: me.email || me.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      checkIn: String(checkIn),
      checkOut: String(checkOut),
      nights,
      adminNote: note || null,

      // ✅ CAMPOS SIMPLIFICADOS (NUEVOS)
      payNow,
      payAtArrival,
      totalStay,

      // precios legacy (mantener por compatibilidad)
      total: total,
      grandTotal: grandTotal,
      discountedTotal: discountedGrandTotal,
      discountedGrandTotal: discountedGrandTotal,
      discountedFirst: discountedFirst,
      firstNightCharge: firstNight,
      totalNightsOnly: totalNightsOnly,
      amountApplied: typeof amountApplied === "number" ? Number(amountApplied) : amountAppliedFromPrice,
      coupon: coupon ?? couponFromPrice ?? null,
      code: code ?? codeFromPrice ?? null,
      currency: currency,
      
      // ✅ jacuzzi con days
      jacuzzi: {
        enabled: Boolean(jacuzziInfo?.enabled),
        fee: Number(jacuzziInfo?.fee ?? jacuzziInfo?.jacuzziFee ?? 0),
        days: Number(jacuzziInfo?.days ?? 0),
      },
      jacuzziFee: Number(jacuzziInfo?.fee ?? jacuzziInfo?.jacuzziFee ?? 0),

      // huéspedes y ocupación
      guests: guestsNum,
      includedBase: includedBase,
      extraGuests: Math.max(0, guestsNum - includedBase),

      // customer: guardamos el mapa completo aquí
      customer: customerObj,
      customerEmail: (customerObj?.email ?? body.customerEmail ?? body.email ?? null),

      // campos raíz para compatibilidad con UI que pueda leer email/name/phone directamente
      email: customerObj?.email ?? body.email ?? null,
      name: customerObj?.name ?? body.name ?? null,
      phone: customerObj?.phone ?? body.phone ?? null,
      userId: customerObj?.userId ?? userId ?? null,

      arrivalTime: customerObj?.arrivalTime ?? arrivalTime ?? null,
      comment: customerObj?.comment ?? comment ?? null,

      // stripe / pagos (vacíos en bloqueo admin)
      stripeCustomerId: null,
      stripePaymentIntentId: null,
      stripeSessionId: null,

      // flags de pago
      paidAt: null,
      paidInFull: false,

      houseIds: targetHouseIds,
      houseId: targetHouseIds[0],
    };

    const ref = await adminDb.collection("reservations").add(payload);
    const snap = await ref.get();

    // Normalizar salida
    const raw = snap.data() as any;
    const normalized: any = { id: snap.id, ...raw };

    normalized.createdAt = toISOIfTimestamp(raw?.createdAt);
    normalized.paidAt = toISOIfTimestamp(raw?.paidAt);
    normalized.deductedAt = toISOIfTimestamp(raw?.deductedAt);
    normalized.updatedAt = toISOIfTimestamp(raw?.updatedAt);

    normalized.checkIn = String(raw.checkIn);
    normalized.checkOut = String(raw.checkOut);
    normalized.guests = Number(raw.guests ?? guestsNum);
    
    // ✅ Campos simplificados
    normalized.payNow = Number(raw.payNow ?? payNow);
    normalized.payAtArrival = Number(raw.payAtArrival ?? payAtArrival);
    normalized.totalStay = Number(raw.totalStay ?? totalStay);
    
    // Legacy
    normalized.total = Number(raw.total ?? grandTotal);
    normalized.grandTotal = Number(raw.grandTotal ?? normalized.total);
    normalized.discountedGrandTotal = Number(raw.discountedGrandTotal ?? normalized.grandTotal);
    normalized.amountApplied = Number(raw.amountApplied ?? 0);
    normalized.totalNightsOnly = Number(raw.totalNightsOnly ?? normalized.total);
    normalized.includedBase = Number(raw.includedBase ?? includedBase);
    normalized.extraGuests = Number(raw.extraGuests ?? Math.max(0, guestsNum - includedBase));
    
    // ✅ Jacuzzi con days
    normalized.jacuzzi = raw.jacuzzi ?? { 
      enabled: false, 
      fee: Number(raw.jacuzziFee ?? 0),
      days: 0
    };
    normalized.coupon = raw.coupon ?? null;
    normalized.code = raw.code ?? (normalized.coupon?.code ?? null);
    normalized.percentDiscount = raw.percentDiscount ?? null;

    // devolver customer normalizado también
    normalized.customer = raw.customer ?? null;
    normalized.customerEmail = raw.customerEmail ?? normalized.email ?? null;
    normalized.email = raw.email ?? null;
    normalized.name = raw.name ?? (normalized.customer?.name ?? null);
    normalized.phone = raw.phone ?? (normalized.customer?.phone ?? null);
    normalized.userId = raw.userId ?? (normalized.customer?.userId ?? null);
    normalized.arrivalTime = raw.arrivalTime ?? (normalized.customer?.arrivalTime ?? null);
    normalized.comment = raw.comment ?? (normalized.customer?.comment ?? null);

    return Response.json({ ok: true, reservation: normalized });
  } catch (e: any) {
    console.error("[admin/reservations/block] error:", e?.message || e);
    return Response.json({ error: e?.message || "Block error" }, { status: 400 });
  }
}