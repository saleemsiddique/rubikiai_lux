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
      paidNow: number; // lo que se pagó ahora
      payAtArrival: number; // lo que queda por pagar
      totalStay: number; // total de la estancia
      discountApplied?: number; // lo descontado del cupón/porcentaje
      currency?: string;
      hotelName?: string;
      hotelContactEmail?: string;
      hotelContactPhone?: string;
    };
    lang?: "en" | "es";
    fromName?: string;
  }
  | {
    type: "owner_reservation_notification";
    to: string | string[];
    data: {
      reservationId: string;
      guestName?: string;
      guestEmail?: string | null;
      guestPhone?: string | null;
      bookingDate?: string;
      checkIn: string;
      checkOut: string;
      nights: number;
      roomType?: string;
      guests: number;
      paidNow: number;
      payAtArrival: number;
      totalStay: number;
      discountApplied?: number;
      currency?: string;
      propertyName?: string;
      propertyId?: string;
      propertyAddress?: string;
      ownerEmail?: string | null;
      ownerPhone?: string | null;
      paymentMethod?: string | null;
      merchantReference?: string | null;
      notes?: string | null;
    };
    lang?: "en" | "es";
    fromName?: string;
  }
  | {
    type: "owner_coupon_notification";
    to: string | string[];
    data: {
      orderId?: string;
      buyerEmail?: string | null;
      unitAmount: number;
      quantity: number;
      currency?: string;
      totalAmount?: number;
      codes: { code: string; remaining: number }[];
      expiresAt?: string;
      purchasedAt?: string;
      paymentMethod?: string | null;
      ownerEmail?: string | null;
    };
    lang?: "en" | "es";
    fromName?: string;
  } | {
    type: "booking_reminder";
    to: string | string[];
    data: {
      guestName: string;
      houseName: string;
      checkIn: string;
      checkOut?: string;
      nGuests?: number;
      variant: "A" | "B"; // A = house L0TeFf2LmrWGAaAyS8NY, B = otros
      notes?: string;
    };
    lang?: "en" | "es";
    fromName?: string;
  }

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
        const {
          reservationId,
          guestName,
          bookingDate,
          checkIn,
          checkOut,
          nights,
          roomType,
          guests,
          paidNow,
          payAtArrival,
          totalStay,
          discountApplied = 0,
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
          paidNow,
          payAtArrival,
          totalStay,
          discountApplied,
          currency,
          hotelName,
          hotelContactEmail,
          hotelContactPhone,
          logoCid,
        });
        break;
      }

      case "owner_reservation_notification": {
        const d = body.data;
        subject = `New reservation: ${d.reservationId}`;
        // importa la plantilla:
        const { OwnerReservationNotificationEmailHtmlEN } = await import(
          "@/app/emails/OwnerReservationNotificationEmailHtmlEN"
        );
        html = OwnerReservationNotificationEmailHtmlEN({
          ...d,
          logoCid,
        } as any);
        break;
      }

      case "owner_coupon_notification": {
        const d = body.data;
        subject = `Coupon purchase: ${d.orderId || "order"}`;
        const { OwnerCouponPurchaseEmailHtmlEN } = await import(
          "@/app/emails/OwnerCouponPurchaseEmailHtmlEN"
        );
        html = OwnerCouponPurchaseEmailHtmlEN({
          ...d,
          logoCid,
        } as any);
        break;
      }
      case "booking_reminder": {
        const {
          guestName,
          houseName,
          checkIn,
          checkOut,
          nGuests = 2,
          variant,
          notes
        } = body.data;

        subject = `Important information for your stay at ${houseName}`;

        console.log("📧 Generando email reminder variant:", variant);

        // Importar las funciones de BookingReminderEmails
        const {
          BookingReminderEmailHtml_A,
          BookingReminderEmailHtml_B,
        } = await import("@/app/emails/BookingReminderEmailHtmlEN");

        const emailParams = {
          guestName,
          houseName,
          checkIn,
          checkOut,
          nGuests,
          notes,
          logoCid,
        };

        html = variant === "A"
          ? BookingReminderEmailHtml_A(emailParams)
          : BookingReminderEmailHtml_B(emailParams);

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
