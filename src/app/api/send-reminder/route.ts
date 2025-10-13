/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, NextRequest } from "next/server";
import { Resend } from "resend";
import fs from "fs/promises";
import path from "path";
import * as admin from "firebase-admin";
import { BookingReminderEmailHtmlEN } from "@/app/emails/BookingReminderEmailHtmlEN";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------- Utils ----------
function initFirebase() {
  if (admin.apps.length) return;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({ credential: admin.credential.cert(svc) });
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
}

function ymdInEuropeMadridPlus(days: number) {
  const tz = "Europe/Madrid";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = fmt.format(new Date());             // YYYY-MM-DD en TZ
  const todayUTC = new Date(`${todayStr}T00:00:00Z`);  // ancla a medianoche UTC
  const target = new Date(todayUTC.getTime() + days * 86400000);
  return target.toISOString().slice(0, 10);            // YYYY-MM-DD
}

function guessGuestName(email: string): string {
  const local = (email || "").split("@")[0] || "Guest";
  return local
    .split(/[._-]+/)
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : ""))
    .filter(Boolean)
    .join(" ");
}

async function getHouseName(db: admin.firestore.Firestore, houseId?: string | null) {
  if (!houseId) return "Your House";
  try {
    const snap = await db.collection("houses").doc(houseId).get();
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

  // Logo
  try {
    const buf = await fs.readFile(path.join(publicDir, "rubikiai-logo.png"));
    attachments.push({
      filename: "rubikiai-logo.png",
      content: buf.toString("base64"),
      contentType: "image/png",
      contentId: logoCid,
    });
  } catch {}

  // House
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
  } catch {}

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

// ---------- GET: ejecuta el cron (Vercel llama GET; algunos “force run” usan HEAD previo) ----------
export async function GET(_req: NextRequest) {
  try {
    // (Opcional) token simple
    if (process.env.CRON_SECRET) {
      const token = _req.nextUrl.searchParams.get("token") || _req.headers.get("x-cron-token");
      if (token !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    initFirebase();
    const db = admin.firestore();

    const targetCheckIn = ymdInEuropeMadridPlus(7);

    const snap = await db
      .collection("reservations")
      .where("status", "==", "reserved")
      .where("checkIn", "==", targetCheckIn)
      .get();

    if (snap.empty) {
      return NextResponse.json({ ok: true, targetCheckIn, total: 0, sent: 0, skipped: 0 });
    }

    const lang: "es" | "en" = (process.env.CRON_LANG as "es" | "en") || "es";
    let sent = 0;
    let skipped = 0;
    const results: Array<{ id: string; to: string; ok: boolean; error?: string }> = [];

    for (const doc of snap.docs) {
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
        const houseName = await getHouseName(db, houseId);
        const guestName = guessGuestName(to);

        await sendReminderViaResend({
          to,
          fromName: "Rubikiai",
          lang,
          data: {
            guestName,
            houseName,
            checkIn: d.checkIn,
            checkOut: d.checkOut,
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

    return NextResponse.json({ ok: true, targetCheckIn, total: snap.size, sent, skipped, results });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Cron error" }, { status: 500 });
  }
}

// ---------- HEAD/OPTIONS para evitar 405 en “force run”/preflight ----------
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
