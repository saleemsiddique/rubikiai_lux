// -------------------- /api/send-reminder (house-aware) --------------------
// app/api/send-reminder/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase-admin";
import fs from "fs/promises";
import path from "path";
import {
  getBookingReminderTemplate,
  getEmailSubject,
  type EmailLocale
} from "@/lib/emailTemplates";
import { getHouseDisplayName } from "@/lib/houseNames";

// ------------ utilidades de fechas (UTC puro) ------------
function dateOnlyIso(d: Date) {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD (UTC)
}

function toDateOnly(value: any): Date {
  if (!value) return new Date(0);
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD en UTC para hoy + `days` */
function ymdUTCPlus(days: number) {
  const now = new Date();
  const target = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + days,
    0, 0, 0, 0
  ));
  return target.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Límites UTC del día [00:00, 24:00) para hoy + `days` */
function utcDayBounds(days: number) {
  const now = new Date();
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + days,
    0, 0, 0, 0
  ));
  const end = new Date(start.getTime() + 86400000);
  return { start, end };
}

// ------------ helpers de email / resend ------------
const resend = new Resend(process.env.RESEND_API_KEY);

function guessGuestName(email: string): string {
  const local = (email || "").split("@")[0] || "Guest";
  return local
    .split(/[._-]+/)
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : ""))
    .filter(Boolean)
    .join(" ");
}

async function getHouseName(houseId?: string | null) {
  if (!houseId) return "Your House";
  try {
    const snap = await adminDb.collection("houses").doc(houseId).get();
    if (!snap.exists) return houseId as string;
    const data = snap.data() || {};
    return (data.name || data.title || data.houseName || (houseId as string)) as string;
  } catch {
    return houseId as string;
  }
}

async function buildInlineAttachments(houseImageFileName?: string) {
  const logoCid = "rubikiai-logo";
  const houseCid = "house-image";
  const publicDir = path.join(process.cwd(), "public");

  const attachments: Array<{
    filename: string;
    content: string;
    contentType?: string;
    contentId?: string;
  }> = [];

  // logo
  try {
    const buf = await fs.readFile(path.join(publicDir, "rubikiai-logo.png"));
    attachments.push({
      filename: "rubikiai-logo.png",
      content: buf.toString("base64"),
      contentType: "image/png",
      contentId: logoCid,
    });
  } catch {/* optional */}

  // house image
  const houseFile = houseImageFileName || "house-default.jpg";
  try {
    const buf = await fs.readFile(path.join(publicDir, houseFile));
    const ext = path.extname(houseFile).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    attachments.push({
      filename: houseFile,
      content: buf.toString("base64"),
      contentType: mime,
      contentId: houseCid,
    });
  } catch {/* optional */}

  return { attachments, logoCid, houseCid };
}

function mapLangToLocale(lang: string): EmailLocale {
  // Direct locale mapping
  if (lang === "en") return "en";
  if (lang === "ru") return "ru";
  if (lang === "lt") return "lt";
  // Legacy: "es" maps to "lt" for backwards compatibility
  return "lt";
}

const HOUSE_A_ID = "L0TeFf2LmrWGAaAyS8NY"; // uses Email A

async function sendReminderViaResend(params: {
  to: string | string[];
  fromName?: string;
  lang: string;
  data: {
    guestName: string;
    houseName: string;
    checkIn: string;
    checkOut?: string;
    nGuests?: number;
    activities?: { title: string; time?: string; description?: string }[];
    notes?: string;
    houseImageFileName?: string;
    houseId?: string | null;
  };
}) {
  const locale = mapLangToLocale(params.lang);

  // Get the appropriate template function for this locale
  const templateFn = await getBookingReminderTemplate(locale);

  // Call the template with the required parameters
const html = templateFn({
  guestName: params.data.guestName,
  reservationId: "",
  houseName: params.data.houseName,
  checkIn: params.data.checkIn,
  checkOut: params.data.checkOut,
  nGuests: params.data.nGuests,
});


  // Get subject line for this locale
  const subject = getEmailSubject('booking-reminder', locale, { houseName: params.data.houseName });

  const sendArgs: any = {
    from: params.fromName
      ? `${params.fromName} <noreply@rubikiailux.lt>`
      : "Rubikiai Lux <noreply@rubikiailux.lt>",
    to: params.to,
    subject,
    html,
  };

  const { error, data } = await new Resend(process.env.RESEND_API_KEY).emails.send(sendArgs);
  if (error) throw error;
  return data;
}

// -------------------- GET (cron) --------------------
export async function GET(_req: NextRequest) {
  try {
    // seguridad opcional por token
    if (process.env.CRON_SECRET) {
      const token =
        _req.nextUrl.searchParams.get("token") ||
        _req.headers.get("x-cron-token");
      if (token !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Toda la lógica anclada a UTC:
    // - El cron en Vercel corre a 09:00 UTC.
    // - targetYMD es el día UTC de dentro de 7 días.
    // - El rango [start, end) es el día UTC completo de dentro de 7 días.
    const targetYMD = ymdUTCPlus(7); // "YYYY-MM-DD" (UTC)
    const { start, end } = utcDayBounds(7); // límites UTC del día objetivo

    const reservationsRef = adminDb.collection("reservations");

    // Caso 1: checkIn guardado como string "YYYY-MM-DD" (interpretado como día UTC)
    const qStr = reservationsRef
      .where("status", "in", ["reserved", "admin"])
      .where("checkIn", "==", targetYMD)
      .get();

    // Caso 2: checkIn guardado como Timestamp -> rango [start, end) en UTC
    const qTs = reservationsRef
      .where("status", "in", ["reserved", "admin"])
      .where("checkIn", ">=", start)
      .where("checkIn", "<", end)
      .get();

    const [snapStr, snapTs] = await Promise.all([qStr, qTs]);

    // merge sin duplicados
    const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    snapStr.forEach((d) => docsById.set(d.id, d));
    snapTs.forEach((d) => docsById.set(d.id, d));

    if (docsById.size === 0) {
      return NextResponse.json({
        ok: true,
        targetCheckIn: targetYMD,
        total: 0,
        sent: 0,
        skipped: 0,
      });
    }

    // CRON_LANG is now fallback only - we prefer locale from each reservation
    const fallbackLang: string = process.env.CRON_LANG || "lt";

    let sent = 0;
    let skipped = 0;
    const results: Array<{ id: string; to: string; ok: boolean; error?: string; locale?: string }> = [];

    for (const [, doc] of docsById) {
      const d = doc.data() as any;
      const to: string | undefined = d.customerEmail;

      if (!to) {
        skipped++;
        results.push({ id: doc.id, to: "(missing email)", ok: false, error: "No customerEmail" });
        continue;
      }

      try {
        // ✅ Get locale from reservation (saved by webhooks/admin), fallback to CRON_LANG
        const lang: string = d.locale || fallbackLang;

        // Handle both single houseId and multiple houseIds
        const houseIdOrIds = d.houseIds || d.houseId;
        const houseName = getHouseDisplayName(houseIdOrIds);
        const guestName = guessGuestName(to);
        const houseId: string | undefined = d.houseId || (Array.isArray(d.houseIds) ? d.houseIds[0] : undefined);

        // normaliza fechas a string YYYY-MM-DD para la plantilla (UTC)
        const checkInStr = dateOnlyIso(toDateOnly(d.checkIn));
        const checkOutStr = d.checkOut ? dateOnlyIso(toDateOnly(d.checkOut)) : undefined;

        await sendReminderViaResend({
          to,
          fromName: "Rubikiai",
          lang,
          data: {
            guestName,
            houseName,
            checkIn: checkInStr,
            checkOut: checkOutStr,
            nGuests: d.guests,
            activities: [],
            notes: undefined,
            houseImageFileName: "house-default.jpg",
            houseId: houseId || null,
          },
        });

        sent++;
        results.push({ id: doc.id, to, ok: true, locale: lang });
      } catch (e: any) {
        skipped++;
        results.push({ id: doc.id, to, ok: false, error: e?.message || "Unknown error" });
      }
    }

    return NextResponse.json({ ok: true, targetCheckIn: targetYMD, total: docsById.size, sent, skipped, results });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Cron error" }, { status: 500 });
  }
}

// -------------------- HEAD / OPTIONS --------------------
export async function HEAD() { return new NextResponse(null, { status: 204 }); }
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
