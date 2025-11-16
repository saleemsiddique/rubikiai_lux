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
      guests,
      customer,
      coupon,
      amountApplied,
      code,
      arrivalTime,
      comment,
      userId,
    } = body || {};

    const guestsNum = Math.max(1, Number(guests || 2));

    if (!isISO(checkIn) || !isISO(checkOut) || checkIn >= checkOut) {
      return Response.json({ error: "Invalid date range" }, { status: 400 });
    }

    // Validate required customer information
    if (!customer || !customer.email || !customer.name) {
      return Response.json({ 
        error: "Customer information (name and email) is required" 
      }, { status: 400 });
    }

    // No permitir bloqueo en el pasado
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

    // Check for conflicts
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
          return true;
        }
      }
      return false;
    });

    const conflictsArray = await Promise.all(conflictPromises);
    if (conflictsArray.some(Boolean)) {
      return Response.json({ 
        error: "Date range overlaps an existing reservation (reserved/complete/admin)" 
      }, { status: 409 });
    }

    // Get pricing
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

    // Extract pricing info
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
    
    const jacuzziInfo = priceJson.jacuzzi ?? { 
      enabled: false, 
      fee: Number(priceJson.jacuzziFee ?? 0),
      days: 0
    };
    
    const discountedFirst = Number(priceJson.discountedFirst ?? 0);
    const currency = priceJson.currency ?? "EUR";

    const payNow = Number(priceJson.payNow ?? discountedFirst);
    const totalStay = Number(priceJson.totalStay ?? discountedGrandTotal);
    const payAtArrival = Number(priceJson.payAtArrival ?? Math.max(0, totalStay - payNow));

    // Build customer object
    const customerObj: any = {
      name: String(customer.name),
      email: String(customer.email),
      phone: customer.phone ? String(customer.phone) : null,
      userId: customer.userId ? String(customer.userId) : (userId ? String(userId) : null),
      arrivalTime: customer.arrivalTime ? String(customer.arrivalTime) : (arrivalTime ? String(arrivalTime) : null),
      comment: customer.comment ? String(customer.comment) : (comment ? String(comment) : null),
    };

    // Create reservation payload
    const payload: any = {
      status: "admin",
      createdBy: me.email || me.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      checkIn: String(checkIn),
      checkOut: String(checkOut),
      nights,

      payNow,
      payAtArrival,
      totalStay,

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
      
      jacuzzi: {
        enabled: Boolean(jacuzziInfo?.enabled),
        fee: Number(jacuzziInfo?.fee ?? jacuzziInfo?.jacuzziFee ?? 0),
        days: Number(jacuzziInfo?.days ?? 0),
      },
      jacuzziFee: Number(jacuzziInfo?.fee ?? jacuzziInfo?.jacuzziFee ?? 0),

      guests: guestsNum,
      includedBase: includedBase,
      extraGuests: Math.max(0, guestsNum - includedBase),

      customer: customerObj,
      customerEmail: customerObj.email,
      email: customerObj.email,
      name: customerObj.name,
      phone: customerObj.phone,
      userId: customerObj.userId,
      arrivalTime: customerObj.arrivalTime,
      comment: customerObj.comment,

      stripeCustomerId: null,
      stripePaymentIntentId: null,
      stripeSessionId: null,

      paidAt: null,
      paidInFull: false,

      houseIds: targetHouseIds,
      houseId: targetHouseIds[0],
    };

    const ref = await adminDb.collection("reservations").add(payload);
    const snap = await ref.get();
    const reservationId = snap.id;

    // ✅ SEND CONFIRMATION EMAIL
    try {
      const customerEmail = customerObj.email;
      if (customerEmail) {
        let discountApplied = 0;
        if (coupon && amountApplied) {
          discountApplied = Number(amountApplied) || 0;
        }

        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "reservation_confirmation",
            to: customerEmail,
            lang: "en",
            data: {
              reservationId,
              guestName: customerObj.name || customerEmail,
              bookingDate: new Date().toISOString().slice(0, 19),
              checkIn,
              checkOut,
              nights,
              roomType: (targetHouseIds.length === 1 ? targetHouseIds[0] : targetHouseIds.join(", ")) || "Accommodation",
              guests: guestsNum,
              paidNow: payNow,
              payAtArrival: payAtArrival,
              totalStay: totalStay,
              discountApplied: discountApplied,
              currency,
              hotelName: "Rubikiai Lux",
              hotelContactEmail: "info@rubikiailux.lt",
              hotelContactPhone: "",
            },
          }),
        })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("Confirmation email send failed:", res.status, text);
            await ref.update({
              emailSendErrorAt: admin.firestore.Timestamp.now(),
              emailSendError: `status_${res.status}`,
              lastEmailResponse: text,
            });
          } else {
            await ref.update({
              confirmationEmailSentAt: admin.firestore.Timestamp.now(),
            });
          }
        })
        .catch(async (e) => {
          console.error("Confirmation email send error:", e);
          await ref.update({
            emailSendErrorAt: admin.firestore.Timestamp.now(),
            emailSendError: String(e?.message ?? e),
          });
        });

        // Wait 600ms before next email
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    } catch (e) {
      console.error("Unexpected error when sending confirmation email:", e);
    }

    // ✅ SEND OWNER NOTIFICATION EMAIL
    try {
      const OWNER_EMAIL = process.env.OWNER_EMAIL; // Replace with your owner email
      
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "owner_reservation_notification",
          to: OWNER_EMAIL,
          data: {
            reservationId,
            guestName: customerObj.name || customerObj.email || "Guest",
            guestEmail: customerObj.email || null,
            guestPhone: customerObj.phone || null,
            bookingDate: new Date().toISOString().slice(0, 19),
            checkIn,
            checkOut,
            nights,
            roomType: (targetHouseIds.length === 1 ? targetHouseIds[0] : targetHouseIds.join(", ")) || "Accommodation",
            guests: guestsNum,
            paidNow: payNow,
            payAtArrival: payAtArrival,
            totalStay: totalStay,
            discountApplied: (coupon && amountApplied) ? Number(amountApplied || 0) : 0,
            currency,
            propertyName: targetHouseIds.join(", ") || "Rubikiai Lux",
            propertyId: targetHouseIds.length === 1 ? targetHouseIds[0] : undefined,
            paymentMethod: "admin_block",
            merchantReference: reservationId,
            notes: customerObj.comment || "",
          },
        }),
      });
      
      // Wait 600ms before next email
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (e) {
      console.error("Owner reservation email failed:", e);
    }

    // ✅ SEND REMINDER EMAIL IF CHECK-IN <= 7 DAYS
    try {
      const customerEmail = customerObj.email;
      if (customerEmail && checkIn) {
        const now = new Date();
        const checkInDate = new Date(checkIn);
        const daysUntilCheckIn = Math.ceil(
          (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        console.log(`📅 Check-in: ${checkIn}, Days until check-in: ${daysUntilCheckIn}`);

        if (daysUntilCheckIn <= 7 && daysUntilCheckIn >= 0) {
          console.log(`📧 Sending reminder (${daysUntilCheckIn} days)`);

          const firstHouseId = targetHouseIds.length > 0 ? targetHouseIds[0] : "";
          const reminderVariant = firstHouseId === "L0TeFf2LmrWGAaAyS8NY" ? "A" : "B";

          const reminderPayload = {
            type: "booking_reminder",
            to: customerEmail,
            lang: "en",
            data: {
              guestName: customerObj.name || customerEmail.split("@")[0],
              houseName: targetHouseIds.length === 1 ? targetHouseIds[0] : (targetHouseIds.join(", ") || "Rubikiai Lux"),
              checkIn,
              checkOut: checkOut || undefined,
              nGuests: guestsNum || 2,
              variant: reminderVariant,
              notes: customerObj.comment || undefined,
            },
          };

          console.log("📤 Reminder payload:", JSON.stringify(reminderPayload, null, 2));

          const reminderRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(reminderPayload),
          });

          if (reminderRes.ok) {
            console.log("✅ Reminder email sent");
            await ref.update({
              reminderEmailSentAt: admin.firestore.Timestamp.now(),
            });
          } else {
            const errorText = await reminderRes.text().catch(() => "");
            console.error("❌ Error sending reminder:", reminderRes.status, errorText);
            await ref.update({
              reminderEmailErrorAt: admin.firestore.Timestamp.now(),
              reminderEmailError: `status_${reminderRes.status}: ${errorText}`,
            });
          }
        } else {
          console.log(`ℹ️ Check-in in ${daysUntilCheckIn} days - no reminder sent`);
        }
      } else {
        console.log("⚠️ No email or checkIn for reminder");
      }
    } catch (e) {
      console.error("❌ Error in booking reminder:", e);
    }

    // Normalize output
    const raw = snap.data() as any;
    const normalized: any = { id: snap.id, ...raw };

    normalized.createdAt = toISOIfTimestamp(raw?.createdAt);
    normalized.paidAt = toISOIfTimestamp(raw?.paidAt);
    normalized.deductedAt = toISOIfTimestamp(raw?.deductedAt);
    normalized.updatedAt = toISOIfTimestamp(raw?.updatedAt);

    normalized.checkIn = String(raw.checkIn);
    normalized.checkOut = String(raw.checkOut);
    normalized.guests = Number(raw.guests ?? guestsNum);
    
    normalized.payNow = Number(raw.payNow ?? payNow);
    normalized.payAtArrival = Number(raw.payAtArrival ?? payAtArrival);
    normalized.totalStay = Number(raw.totalStay ?? totalStay);
    
    normalized.total = Number(raw.total ?? grandTotal);
    normalized.grandTotal = Number(raw.grandTotal ?? normalized.total);
    normalized.discountedGrandTotal = Number(raw.discountedGrandTotal ?? normalized.grandTotal);
    normalized.amountApplied = Number(raw.amountApplied ?? 0);
    normalized.totalNightsOnly = Number(raw.totalNightsOnly ?? normalized.total);
    normalized.includedBase = Number(raw.includedBase ?? includedBase);
    normalized.extraGuests = Number(raw.extraGuests ?? Math.max(0, guestsNum - includedBase));
    
    normalized.jacuzzi = raw.jacuzzi ?? { 
      enabled: false, 
      fee: Number(raw.jacuzziFee ?? 0),
      days: 0
    };
    normalized.coupon = raw.coupon ?? null;
    normalized.code = raw.code ?? (normalized.coupon?.code ?? null);
    normalized.percentDiscount = raw.percentDiscount ?? null;

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