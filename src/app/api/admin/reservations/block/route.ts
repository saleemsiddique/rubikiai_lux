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
      arrivalTime,
      comment,
      userId,
      jacuzzi,
      discount,
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

    // Don't allow blocking past dates
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

    // ✅ GET PRICING FROM PRICE API (usando la misma lógica que checkout)
    const origin = new URL(req.url).origin;
    const houseIdForPrice = targetHouseIds.join("__");

    // Build pricing request with jacuzzi info
    const priceRequestBody: any = {
      houseId: houseIdForPrice,
      startDate: checkIn,
      endDate: checkOut,
      guests: guestsNum,
    };

    // Add jacuzzi to pricing request if enabled
    if (jacuzzi?.enabled) {
      priceRequestBody.jacuzzi = true;
      priceRequestBody.jacuzziDays = Math.max(1, Number(jacuzzi.days || 1));
    }

    const priceRes = await fetch(`${origin}/api/reservations/price`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(priceRequestBody),
    });

    if (!priceRes.ok) {
      const txt = await priceRes.text().catch(() => "");
      return Response.json({ error: `Price API error: ${txt || priceRes.statusText}` }, { status: 422 });
    }

    const priceJson: any = await priceRes.json();
    if (priceJson?.error) {
      return Response.json({ error: `Price API: ${priceJson.error}` }, { status: 422 });
    }

    // ✅ EXTRACT PRICING INFO FROM API RESPONSE
    const nights = Number(priceJson.nights ?? nightsBetween(checkIn, checkOut));
    const includedBase = Number(priceJson.includedBase ?? 2);
    const extraGuests = Number(priceJson.extraGuests ?? Math.max(0, guestsNum - includedBase));
    const currency = "EUR";

    // Precios base (sin descuento)
    const firstNightBase = Number(priceJson.first ?? 0); // Reservation fee
    const totalNightsOnly = Number(priceJson.total ?? 0); // Total de noches sin jacuzzi
    const jacuzziFee = Number(priceJson.jacuzziFee ?? 0);
    const jacuzziDays = Number(priceJson.jacuzziDays ?? 0);
    const extrasTotal = Number(priceJson.extrasTotal ?? jacuzziFee);
    const grandTotalBase = Number(priceJson.grandTotal ?? (totalNightsOnly + extrasTotal));

    // Jacuzzi info estructurado
    const jacuzziInfo = {
      enabled: Boolean(jacuzzi?.enabled),
      fee: jacuzziFee,
      days: jacuzziDays,
    };

    // ✅ APPLY DISCOUNT IF PROVIDED
    let discountedFirst = firstNightBase;
    let discountedGrandTotal = grandTotalBase;
    let amountApplied = 0;
    let couponData: any = null;
    let codeFromDiscount: string | null = null;

    if (discount && discount.code && discount.type) {
      const discountAmount = Number(discount.amount || 0);

      if (discountAmount > 0) {
        if (discount.type === "coupon") {
          // Coupon: fixed euro amount off (applies to first night, limited by grandTotal)
          amountApplied = Math.min(discountAmount, firstNightBase, grandTotalBase);
          discountedFirst = Math.max(0, firstNightBase - amountApplied);
          discountedGrandTotal = Math.max(0, grandTotalBase - amountApplied);

          couponData = {
            code: discount.code,
            type: "coupon",
            value: discountAmount,
            applied: amountApplied,
          };
          codeFromDiscount = discount.code;
        } else if (discount.type === "percent") {
          // Percentage: applies only to first night
          const percentValue = Math.min(100, Math.max(0, discountAmount));
          const discountOnFirstNight = (percentValue / 100) * firstNightBase;

          amountApplied = discountOnFirstNight;
          discountedFirst = Math.max(0, firstNightBase - discountOnFirstNight);
          discountedGrandTotal = Math.max(0, grandTotalBase - discountOnFirstNight);

          couponData = {
            code: discount.code,
            type: "percent",
            percent: percentValue,
            applied: amountApplied,
          };
          codeFromDiscount = discount.code;
        }
      }
    }

    // ✅ CALCULATE PAYMENT BREAKDOWN
    const payNow = discountedFirst; // Reservation fee (con descuento)
    const totalStay = discountedGrandTotal; // Grand total (con descuento)
    const payAtArrival = Math.max(0, totalStay - payNow);

    // Build customer object
    const customerObj: any = {
      name: String(customer.name),
      email: String(customer.email),
      phone: customer.phone ? String(customer.phone) : null,
      userId: customer.userId ? String(customer.userId) : (userId ? String(userId) : null),
      arrivalTime: customer.arrivalTime ? String(customer.arrivalTime) : (arrivalTime ? String(arrivalTime) : null),
      comment: customer.comment ? String(customer.comment) : (comment ? String(comment) : null),
    };

    // ✅ CREATE RESERVATION PAYLOAD
    const payload: any = {
      status: "admin",
      createdBy: me.email || me.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      checkIn: String(checkIn),
      checkOut: String(checkOut),
      nights,

      // ✅ SIMPLIFIED PRICING FIELDS (NEW STANDARD)
      payNow,           // Reservation fee (con descuento si aplica)
      payAtArrival,     // Resto a pagar
      totalStay,        // Grand total (con descuento si aplica)

      // ✅ DETAILED PRICING FIELDS (for transparency & legacy compatibility)
      firstNightBase,        // Reservation fee base (sin descuento)
      totalNightsOnly,       // Total de noches sin extras
      grandTotal: grandTotalBase, // Grand total base (sin descuento)
      discountedFirst,       // Reservation fee con descuento
      discountedGrandTotal,  // Grand total con descuento
      amountApplied,         // Cantidad de descuento aplicada
      coupon: couponData,    // Info del cupón/descuento
      code: codeFromDiscount,
      currency,

      // Jacuzzi info (con días)
      jacuzzi: jacuzziInfo,
      jacuzziFee,
      jacuzziDays,
      extrasTotal, // Total de extras (jacuzzi, etc)

      guests: guestsNum,
      includedBase,
      extraGuests,

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

    // ✅ UPDATE DISCOUNT IN FIRESTORE (COUPON OR PERCENTAGE)
    if (discount && discount.type && amountApplied > 0) {
      try {
        if (discount.type === "coupon" && discount.code) {
          // Update coupon: subtract from remaining balance
          const couponRef = adminDb.collection("coupons").where("code", "==", discount.code).limit(1);
          const couponSnap = await couponRef.get();
          
          if (!couponSnap.empty) {
            const couponDoc = couponSnap.docs[0];
            const currentRemaining = Number(couponDoc.data().remaining ?? 0);
            const newRemaining = Math.max(0, currentRemaining - amountApplied);
            
            await couponDoc.ref.update({
              remaining: newRemaining,
              lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
              usageHistory: admin.firestore.FieldValue.arrayUnion({
                reservationId,
                amount: amountApplied,
                usedAt: admin.firestore.Timestamp.now(),
                usedBy: customerObj.email,
              }),
            });
            
            console.log(`✅ Coupon ${discount.code} updated: ${currentRemaining} → ${newRemaining}`);
          }
        } else if (discount.type === "percent" && discount.code) {
          // Update percentage discount: mark as used
          const percentRef = adminDb.collection("percentage_discounts").where("code", "==", discount.code).limit(1);
          const percentSnap = await percentRef.get();
          
          if (!percentSnap.empty) {
            const percentDoc = percentSnap.docs[0];
            
            await percentDoc.ref.update({
              used: true,
              usedAt: admin.firestore.FieldValue.serverTimestamp(),
              usedBy: customerObj.email,
              usedInReservation: reservationId,
            });
            
            console.log(`✅ Percentage discount ${discount.code} marked as used`);
          }
        }
      } catch (discountUpdateError) {
        console.error("❌ Error updating discount in Firestore:", discountUpdateError);
        // Don't fail the reservation if discount update fails
        await ref.update({
          discountUpdateError: String(discountUpdateError),
          discountUpdateErrorAt: admin.firestore.Timestamp.now(),
        });
      }
    }

    // ✅ SEND CONFIRMATION EMAIL
    try {
      const customerEmail = customerObj.email;
      if (customerEmail) {
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
              discountApplied: amountApplied,
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
      const OWNER_EMAIL = process.env.OWNER_EMAIL;

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
            discountApplied: amountApplied,
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

    // ✅ NORMALIZE OUTPUT
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

    normalized.firstNightBase = Number(raw.firstNightBase ?? firstNightBase);
    normalized.totalNightsOnly = Number(raw.totalNightsOnly ?? totalNightsOnly);
    normalized.grandTotal = Number(raw.grandTotal ?? grandTotalBase);
    normalized.discountedFirst = Number(raw.discountedFirst ?? discountedFirst);
    normalized.discountedGrandTotal = Number(raw.discountedGrandTotal ?? discountedGrandTotal);
    normalized.amountApplied = Number(raw.amountApplied ?? amountApplied);
    normalized.includedBase = Number(raw.includedBase ?? includedBase);
    normalized.extraGuests = Number(raw.extraGuests ?? extraGuests);

    normalized.jacuzzi = raw.jacuzzi ?? jacuzziInfo;
    normalized.jacuzziFee = Number(raw.jacuzziFee ?? jacuzziFee);
    normalized.jacuzziDays = Number(raw.jacuzziDays ?? jacuzziDays);
    normalized.extrasTotal = Number(raw.extrasTotal ?? extrasTotal);
    
    normalized.coupon = raw.coupon ?? couponData;
    normalized.code = raw.code ?? codeFromDiscount;

    normalized.customer = raw.customer ?? customerObj;
    normalized.customerEmail = raw.customerEmail ?? customerObj.email;
    normalized.email = raw.email ?? customerObj.email;
    normalized.name = raw.name ?? customerObj.name;
    normalized.phone = raw.phone ?? customerObj.phone;
    normalized.userId = raw.userId ?? customerObj.userId;
    normalized.arrivalTime = raw.arrivalTime ?? customerObj.arrivalTime;
    normalized.comment = raw.comment ?? customerObj.comment;

    return Response.json({ ok: true, reservation: normalized });
  } catch (e: any) {
    console.error("[admin/reservations/block] error:", e?.message || e);
    return Response.json({ error: e?.message || "Block error" }, { status: 400 });
  }
}