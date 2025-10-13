/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase-admin";
import fs from "fs/promises";
import path from "path";
import { BookingReminderEmailHtmlEN } from "@/app/emails/BookingReminderEmailHtmlEN";

// ------------ utilidades de fechas (compatibles con tu otro API) ------------
function dateOnlyIso(d: Date) { return d.toISOString().split("T")[0]; }
function toDateOnly(value: any): Date {
  if (!value) return new Date(0);
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    d.setHours(0, 0, 0, 0);
    return d;
    }
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD en Europe/Madrid para hoy + `days` */
function ymdInEuropeMadridPlus(days: number) {
  const tz = "Europe/Madrid";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const todayStr = fmt.format(new Date());              // YYYY-MM-DD (TZ)
  const todayUTC = new Date(`${todayStr}T00:00:00Z`);   // anclado a 00:00 UTC del día TZ
  const target = new Date(todayUTC.getTime() + days * 86400000);
  return target.toISOString().slice(0, 10);             // YYYY-MM-DD
}

/** Límites UTC del día (00:00 a 24:00) en Europe/Madrid para hoy + `days` */
function madridDayBoundsUTC(days: number) {
  const tz = "Europe/Madrid";
  // día objetivo como string TZ
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const todayStr = fmt.format(new Date());
  const todayUTC = new Date(`${todayStr}T00:00:00Z`);
  const targetLocalMidnightUTC = new Date(todayUTC.getTime() + days * 86400000);
  const start = targetLocalMidnightUTC;                        // 00:00 TZ en UTC
  const end = new Date(start.getTime() + 86400000);            // +1 día
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
    if (!snap.exists) return houseId;
    const data = snap.data() || {};
    return (data.name || data.title || data.houseName || houseId) as string;
  } catch {
    return houseId;
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
  } catch { /* opcional */ }

  // imagen casa
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
  } catch { /* opcional */ }

  return { attachments, logoCid, houseCid };
}

function subjectFor(lang: "en" | "es", houseName: string) {
  return lang === "en"
    ? `Your stay at ${houseName} — 1 week to go`
    : `Tu estancia en ${houseName} — queda 1 semana`;
}

async function sendReminderViaResend(params: {
  to: string | string[];
  fromName?: string;
  lang: "en" | "es";
  data: {
    guestName: string;
    houseName: string;
    checkIn: string;
    checkOut?: string;
    nGuests?: number;
    activities?: { title: string; time?: string; description?: string }[];
    notes?: string;
    houseImageFileName?: string;
  };
}) {
  const { attachments, logoCid, houseCid } = await buildInlineAttachments(
    params.data.houseImageFileName
  );

  const html = BookingReminderEmailHtmlEN({
    guestName: params.data.guestName,
    houseName: params.data.houseName,
    checkIn: params.data.checkIn,
    checkOut: params.data.checkOut,
    nGuests: params.data.nGuests,
    activities: params.data.activities,
    notes: params.data.notes,
    logoCid,
    houseImageCid: houseCid,
  });

  const sendArgs: any = {
    from: params.fromName
      ? `${params.fromName} <noreply@culinarium.io>`
      : "Rubikiai Lux <noreply@culinarium.io>",
    to: params.to,
    subject: subjectFor(params.lang, params.data.houseName),
    html,
    attachments: attachments.length ? attachments : undefined,
  };

  const { error, data } = await resend.emails.send(sendArgs);
  if (error) throw error;
  return data;
}

// -------------------- GET (cron) --------------------
export async function GET(_req: NextRequest) {
  try {
    // seguridad opcional por token
    if (process.env.CRON_SECRET) {
      const token = _req.nextUrl.searchParams.get("token") || _req.headers.get("x-cron-token");
      if (token !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const targetYMD = ymdInEuropeMadridPlus(7);        // "YYYY-MM-DD"
    const { start, end } = madridDayBoundsUTC(7);      // límites UTC del día en Madrid

    const reservationsRef = adminDb.collection("reservations");

    // Caso 1: checkIn guardado como string "YYYY-MM-DD"
    const qStr = reservationsRef
      .where("status", "==", "reserved")
      .where("checkIn", "==", targetYMD)
      .get();

    // Caso 2: checkIn guardado como Timestamp -> rango [start, end)
    const qTs = reservationsRef
      .where("status", "==", "reserved")
      .where("checkIn", ">=", start)
      .where("checkIn", "<", end)
      .get();

    const [snapStr, snapTs] = await Promise.all([qStr, qTs]);

    // merge sin duplicados
    const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    snapStr.forEach((d) => docsById.set(d.id, d));
    snapTs.forEach((d) => docsById.set(d.id, d));

    if (docsById.size === 0) {
      return NextResponse.json({ ok: true, targetCheckIn: targetYMD, total: 0, sent: 0, skipped: 0 });
    }

    const lang: "es" | "en" = (process.env.CRON_LANG as "es" | "en") || "es";

    let sent = 0;
    let skipped = 0;
    const results: Array<{ id: string; to: string; ok: boolean; error?: string }> = [];

    for (const [, doc] of docsById) {
      const d = doc.data() as any;
      const to: string | undefined = d.customerEmail;

      if (!to) {
        skipped++;
        results.push({ id: doc.id, to: "(missing email)", ok: false, error: "No customerEmail" });
        continue;
      }

      try {
        const houseId: string | undefined =
          d.houseId || (Array.isArray(d.houseIds) ? d.houseIds[0] : undefined);
        const houseName = await getHouseName(houseId);
        const guestName = guessGuestName(to);

        // normaliza fechas a string YYYY-MM-DD para la plantilla
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
          },
        });

        sent++;
        results.push({ id: doc.id, to, ok: true });
      } catch (e: any) {
        skipped++;
        results.push({ id: doc.id, to, ok: false, error: e?.message || "Unknown error" });
      }
    }

    return NextResponse.json({
      ok: true,
      targetCheckIn: targetYMD,
      total: docsById.size,
      sent,
      skipped,
      results,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Cron error" }, { status: 500 });
  }
}

// -------------------- HEAD / OPTIONS (evitar 405 en force run) --------------------
export async function HEAD() {
  return new NextResponse(null, { status: 204 });
}

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
