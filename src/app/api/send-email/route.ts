/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Resend } from "resend";
import fs from "fs/promises";
import path from "path";
import { CouponPurchaseEmailHtmlEN } from "@/app/emails/CouponPurchaseEmailHtmlEN";
import { DiscountCodeEmailHtml } from "@/app/emails/DiscountCodeEmailHtml";
import { ReservationConfirmationEmailHtmlEN } from "@/app/emails/ReservationConfirmationEmailHtmlEN";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const resend = new Resend(process.env.RESEND_API_KEY);

// Tipos soportados:
export type SendEmailBody =
  | {
      type: "coupon_purchase";
      to: string | string[];
      data: {
        unitAmount: number;
        quantity: number;
        currency?: string;
        codes: { code: string; remaining: number }[];
        expiresAt: string; // ISO YYYY-MM-DD
        buyerEmail?: string | null;
      };
      lang?: "en" | "es";
      fromName?: string;
    }
  | {
      type: "discount_code";
      to: string | string[];
      data: {
        code: string;
        percent: number;
        expiresAt: string; // YYYY-MM-DD
      };
      lang?: "en" | "es";
      fromName?: string;
    }
  | {
      type: "reservation_confirmation";
      to: string | string[];
      data: {
        reservationId: string;
        guestName: string;
        bookingDate: string;
        checkIn: string;
        checkOut: string;
        nights: number;
        roomType: string;
        guests: number;
        unitAmount: number; // amount charged now (first night)
        totalAmount?: number; // grand total for whole stay (to be paid at arrival)
        currency?: string;
        hotelName?: string;
        hotelContactEmail?: string;
        hotelContactPhone?: string;
      };
      lang?: "en" | "es";
      fromName?: string;
    };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SendEmailBody;

    const accept = (await headers()).get("accept-language") ?? "";
    const lang: "en" | "es" =
      body.lang ?? (accept.toLowerCase().startsWith("en") ? "en" : "es");

    let subject: string;
    let html: string;

    // --- preparamos el CID del logo (inline attachment) ---
    const logoCid = "rubikiai-logo";
    const publicDir = path.join(process.cwd(), "public");
    const logoPath = path.join(publicDir, "rubikiai-logo.png");

    let logoAttachment:
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

    switch (body.type) {
      case "coupon_purchase": {
        const {
          unitAmount,
          quantity,
          currency = "EUR",
          codes,
          expiresAt,
        } = body.data;
        subject =
          lang === "en"
            ? "Your Rubikiai Lux coupon(s)"
            : "Tus cupones de Rubikiai Lux";

        html = CouponPurchaseEmailHtmlEN({
          unitAmount,
          quantity,
          currency,
          codes,
          expiresAt,
          logoCid,
        });
        break;
      }

      case "discount_code": {
        const { code, percent, expiresAt } = body.data;
        subject =
          lang === "en"
            ? `Your ${percent}% personal discount`
            : `Tu descuento personal del ${percent}%`;

        html = DiscountCodeEmailHtml({
          code,
          percent,
          expiresAt,
          logoCid,
        });
        break;
      }

      case "reservation_confirmation": {
        // This endpoint uses the English reservation confirmation template.
        const {
          reservationId,
          guestName,
          bookingDate,
          checkIn,
          checkOut,
          nights,
          roomType,
          guests,
          unitAmount,
          totalAmount,
          currency = "EUR",
          hotelName,
          hotelContactEmail,
          hotelContactPhone,
        } = body.data;

        subject = `Reservation confirmation — ${reservationId}`;

        html = ReservationConfirmationEmailHtmlEN({
          reservationId,
          guestName,
          bookingDate,
          checkIn,
          checkOut,
          nights,
          roomType,
          guests,
          // unitAmount = amount charged now (first night)
          unitAmount,
          // totalAmount = grand total for whole stay (to be paid at arrival)
          totalAmount,
          currency,
          hotelName,
          hotelContactEmail,
          hotelContactPhone,
          logoCid,
        });
        break;
      }

      default:
        return NextResponse.json(
          { error: "Tipo de email no válido" },
          { status: 400 }
        );
    }

    const fromDisplay = body.fromName
      ? `${body.fromName} <noreply@rubikiai.lt>`
      : "Rubikiai Lux <noreply@rubikiai.lt>";

    const sendArgs: any = {
      from: fromDisplay,
      to: body.to,
      subject,
      html,
    };

    if (logoAttachment) {
      sendArgs.attachments = [logoAttachment];
    }

    const { data, error } = await resend.emails.send(sendArgs);

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Error enviando email" },
      { status: 500 }
    );
  }
}
