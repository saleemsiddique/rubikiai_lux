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

// Supported body types
export type SendEmailBody =
  | {
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
        // Optional: allow caller to override attachment filenames inside /public
        houseImageFileName?: string; // e.g. "house-123.jpg" (must be in public/)
      };
      lang?: "en" | "es";
      fromName?: string;
    }
  | {
      // keep previous coupon case if you want compatibility
      type: "coupon_purchase";
      to: string | string[];
      data: any;
      lang?: "en" | "es";
      fromName?: string;
    };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SendEmailBody;

    // Basic lang detection like your example
    const accept = (await headers()).get("accept-language") ?? "";
    const lang: "en" | "es" = body.lang ?? (accept.toLowerCase().startsWith("en") ? "en" : "es");

    let subject: string;
    let html: string;

    // Prepare default CIDs and attachments from /public
    const logoCid = "rubikiai-logo";
    const houseCid = "house-image";

    const publicDir = path.join(process.cwd(), "public");
    const logoPath = path.join(publicDir, "rubikiai-logo.png");
    // optional house image may be provided in body.data.houseImageFileName
    // fall back to a generic file name
    const defaultHouseImageFile = "house-default.jpg";

    // Read attachments if they exist
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

    // determine house image file name
    let houseImageFile = defaultHouseImageFile;
    if (body.type === "booking_reminder" && body.data.houseImageFileName) {
      houseImageFile = body.data.houseImageFileName;
    }
    const houseImagePath = path.join(publicDir, houseImageFile);

    try {
      const buf = await fs.readFile(houseImagePath);
      // attempt to guess MIME type by extension (jpg/jpeg/png)
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

    switch (body.type) {
      case "booking_reminder": {
        const { guestName, houseName, checkIn, checkOut, nGuests, activities, notes } = body.data;
        subject = lang === "en" ? `Your stay at ${houseName} — 1 week to go` : `Tu estancia en ${houseName} — queda 1 semana`;
        html = BookingReminderEmailHtmlEN({
          guestName,
          houseName,
          checkIn,
          checkOut,
          nGuests,
          activities,
          notes,
          logoCid,
          houseImageCid: houseCid,
        });
        break;
      }

      case "coupon_purchase": {
        // If you want to keep backward compatibility, call your existing template here
        return NextResponse.json({ error: "coupon_purchase not handled in this route" }, { status: 400 });
      }

      default:
        return NextResponse.json({ error: "Invalid email type" }, { status: 400 });
    }

    const fromDisplay = body.fromName ? `${body.fromName} <noreply@culinarium.io>` : "Rubikiai <noreply@culinarium.io>";

    const sendArgs: any = {
      from: fromDisplay,
      to: body.to,
      subject,
      html,
    };

    // attach inline images (CID)
    const attachments = [];
    if (logoAttachment) attachments.push(logoAttachment);
    if (houseAttachment) attachments.push(houseAttachment);
    if (attachments.length > 0) sendArgs.attachments = attachments;

    const { data, error } = await resend.emails.send(sendArgs);

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Error sending email" }, { status: 500 });
  }
}
