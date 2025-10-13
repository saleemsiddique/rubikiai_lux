/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Resend } from "resend";
import fs from "fs/promises";
import path from "path";
import { BookingReminderEmailHtmlEN } from "@/app/emails/BookingReminderEmailHtmlEN";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const resend = new Resend(process.env.RESEND_API_KEY);

// Body type: ONLY booking_reminder
export type SendEmailBody = {
  type: "booking_reminder";
  to: string | string[];
  data: {
    guestName: string;
    houseName: string;
    checkIn: string; // ISO
    checkOut?: string;
    nGuests?: number;
    activities?: { title: string; time?: string; description?: string }[];
    notes?: string;
    houseImageFileName?: string;
  };
  lang?: "en" | "es";
  fromName?: string;
};

// ----- Helpers de fechas/zonas -----
const DEFAULT_TZ = process.env.REMINDER_TIMEZONE ?? "Europe/Madrid";
const DEFAULT_HOUR = Number(process.env.REMINDER_SEND_HOUR ?? 21); // hora local que debe coincidir
const DEFAULT_DAYS_BEFORE = Number(process.env.REMINDER_DAYS_BEFORE ?? 7);

// devuelve 'YYYY-MM-DD' en la zona tz
function dateKeyInTZ(d: Date, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// devuelve diferencia en días (to - from) comparando fechas locales en tz
function daysBetweenInTZ(from: Date, to: Date, tz = DEFAULT_TZ) {
  const fromKey = dateKeyInTZ(from, tz);
  const toKey = dateKeyInTZ(to, tz);
  const fromMs = Date.parse(`${fromKey}T00:00:00Z`);
  const toMs = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

// devuelve la hora (0-23) en la zona tz
function hourInTZ(d: Date, tz = DEFAULT_TZ) {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(d);
  return parseInt(s, 10);
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";

    const body = (await req.json()) as SendEmailBody;

    // Asegurarnos de que el tipo es booking_reminder
    if (!body || body.type !== "booking_reminder") {
      return NextResponse.json({ error: "Only booking_reminder requests are accepted" }, { status: 400 });
    }

    // Validación del secreto (si está configurado)
    const expected = process.env.CRON_SECRET;
    if (expected) {
      const authHeader = (await headers()).get("authorization") ?? "";
      const okHeader = authHeader === `Bearer ${expected}`;
      const qSecret = url.searchParams.get("secret");
      const okQuery = qSecret === expected;
      if (!okHeader && !okQuery && !force) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Hora y día actual en la zona objetivo
    const now = new Date();
    const tz = process.env.REMINDER_TIMEZONE ?? DEFAULT_TZ;
    const currentHour = hourInTZ(now, tz);

    // Si no forzamos, comprobamos hora objetivo
    if (!force) {
      const targetHour = Number(process.env.REMINDER_SEND_HOUR ?? DEFAULT_HOUR);
      if (Number.isFinite(targetHour)) {
        if (currentHour !== targetHour) {
          return NextResponse.json({
            ok: true,
            skipped: true,
            reason: "Not target hour in timezone",
            timezone: tz,
            currentHour,
            expectedHour: targetHour,
          });
        }
      }
    }

    // Determinamos idioma
    const accept = (await headers()).get("accept-language") ?? "";
    const lang: "en" | "es" = body.lang ?? (accept.toLowerCase().startsWith("en") ? "en" : "es");

    // Prepare default CIDs and attachments from /public
    const logoCid = "rubikiai-logo";
    const houseCid = "house-image";

    const publicDir = path.join(process.cwd(), "public");
    const logoPath = path.join(publicDir, "rubikiai-logo.png");
    const defaultHouseImageFile = "house-default.jpg";

    let logoAttachment:
      | {
          filename: string;
          content: string;
          contentType?: string;
          contentId?: string;
        }
      | undefined;
    let houseAttachment:
      | {
          filename: string;
          content: string;
          contentType?: string;
          contentId?: string;
        }
      | undefined;

    try {
      const buf = await fs.readFile(logoPath);
      logoAttachment = {
        filename: "rubikiai-logo.png",
        content: buf.toString("base64"),
        contentType: "image/png",
        contentId: logoCid,
      };
    } catch {
      logoAttachment = undefined;
    }

    // Manejo específico del recordatorio de reserva
    const { guestName, houseName, checkIn: checkInIso, checkOut, nGuests, activities, notes } = body.data;

    if (!checkInIso) {
      return NextResponse.json({ error: "Missing checkIn" }, { status: 400 });
    }

    const checkInDate = new Date(checkInIso);
    if (Number.isNaN(checkInDate.getTime())) {
      return NextResponse.json({ error: "Invalid checkIn date" }, { status: 400 });
    }

    // Calculamos días hasta check-in **en la zona tz**
    const daysUntil = daysBetweenInTZ(now, checkInDate, tz);
    const daysBefore = Number(process.env.REMINDER_DAYS_BEFORE ?? DEFAULT_DAYS_BEFORE);

    if (!force && daysUntil !== daysBefore) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Not matching days-before condition",
        timezone: tz,
        nowDateKey: dateKeyInTZ(now, tz),
        checkInDateKey: dateKeyInTZ(checkInDate, tz),
        daysUntil,
        expectedDaysUntil: daysBefore,
      });
    }

    // Adjuntar imagen de la casa si existe (opcional)
    let houseImageFile = defaultHouseImageFile;
    if (body.data.houseImageFileName) houseImageFile = body.data.houseImageFileName;
    const houseImagePath = path.join(publicDir, houseImageFile);

    try {
      const buf = await fs.readFile(houseImagePath);
      const ext = path.extname(houseImageFile).toLowerCase();
      const mime = ext === ".png" ? "image/png" : "image/jpeg";
      houseAttachment = {
        filename: houseImageFile,
        content: buf.toString("base64"),
        contentType: mime,
        contentId: houseCid,
      };
    } catch {
      houseAttachment = undefined;
    }

    // Construir asunto y HTML (siguiendo tu plantilla)
    const subject = lang === "en" ? `Your stay at ${houseName} — ${daysBefore} days to go` : `Tu estancia en ${houseName} — quedan ${daysBefore} días`;
    const html = BookingReminderEmailHtmlEN({
      guestName,
      houseName,
      checkIn: checkInIso,
      checkOut,
      nGuests,
      activities,
      notes,
      logoCid,
      houseImageCid: houseCid,
    });

    const fromDisplay = body.fromName ? `${body.fromName} <noreply@culinarium.io>` : "Rubikiai <noreply@culinarium.io>";

    const sendArgs: any = {
      from: fromDisplay,
      to: body.to,
      subject,
      html,
    };

    const attachments = [];
    if (logoAttachment) attachments.push(logoAttachment);
    if (houseAttachment) attachments.push(houseAttachment);
    if (attachments.length > 0) sendArgs.attachments = attachments;

    // Envío
    const res = await resend.emails.send(sendArgs);
    return NextResponse.json({ ok: true, sent: true, result: res });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Error sending email" }, { status: 500 });
  }
}
