/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Resend } from "resend";
import fs from "fs/promises";
import path from "path";
import {
  getCouponPurchaseTemplate,
  getReservationConfirmationTemplate,
  getBookingReminderTemplate,
  getDiscountCodeTemplate,
  getEmailSubject,
  type EmailLocale
} from "@/lib/emailTemplates";
import { getTranslations } from 'next-intl/server';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const resend = new Resend(process.env.RESEND_API_KEY);

// Helper to map old lang to new locale
function mapLangToLocale(lang?: "en" | "es", headers?: string): EmailLocale {
  // If no lang provided, try to detect from headers or default to 'lt'
  if (!lang) {
    if (headers && headers.toLowerCase().startsWith("ru")) return 'ru';
    if (headers && headers.toLowerCase().startsWith("en")) return 'en';
    return 'lt'; // Lithuanian default
  }
  // Map old "es" to "lt" (Lithuanian) since Spanish wasn't supported before
  return lang === "en" ? "en" : "lt";
}

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
    locale?: EmailLocale; // new i18n support
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
    locale?: EmailLocale;
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
    locale?: EmailLocale;
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
    locale?: EmailLocale;
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
    locale?: EmailLocale;
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
    locale?: EmailLocale;
    fromName?: string;
  }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  try {
    const { locale: routeLocale } = await params;
    const t = await getTranslations({ locale: routeLocale, namespace: 'api.errors' });
    const body = (await req.json()) as SendEmailBody;

    const accept = (await headers()).get("accept-language") ?? "";

    // Determine locale: prefer explicit body.locale, then routeLocale from URL, then fallback to lang mapping or headers
    // This ensures we use the locale from the URL path (e.g., /ru/api/send-email) if body.locale is not provided
    const locale: EmailLocale =
      body.locale ??
      (routeLocale as EmailLocale) ??
      mapLangToLocale(body.lang, accept);

    // Log locale for debugging email language issues
    console.log(`📧 Sending ${body.type} email to ${body.to} in locale: ${locale} (body.locale: ${body.locale}, routeLocale: ${routeLocale}, body.lang: ${body.lang})`);

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
          codes,
          expiresAt,
        } = body.data;

        // Get subject line for this locale
        subject = getEmailSubject('coupon-purchase', locale);

        // Get and call the appropriate template function
        const templateFn = await getCouponPurchaseTemplate(locale);

        html = templateFn({
          unitAmount,
          quantity,
          currency: body.data.currency || "EUR",
          codes,
          expiresAt,
          logoCid,
        });
        break;
      }

      case "discount_code": {
        const { code, percent, expiresAt } = body.data;

        // Get subject line for this locale
        subject =
          locale === "en"
            ? `Your ${percent}% personal discount`
            : locale === "ru"
              ? `Ваша персональная скидка ${percent}%`
              : `Tavo asmeninė ${percent}% nuolaida`;

        // Get and call the appropriate template function
        const templateFn = await getDiscountCodeTemplate(locale);

        html = templateFn({
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
          discountApplied,
        } = body.data;

        // Get subject line for this locale
        subject = getEmailSubject('reservation-confirmation', locale, { reservationId });

        // Get and call the appropriate template function
        const templateFn = await getReservationConfirmationTemplate(locale);

        html = templateFn({
          reservationId,
          guestName,
          bookingDate: bookingDate || new Date().toISOString().slice(0, 19),
          checkIn,
          checkOut,
          nights: nights || 1,
          roomType,
          guests,
          paidNow,
          payAtArrival,
          totalStay,
          discountApplied,
          currency: body.data.currency || "EUR",
          hotelName: body.data.hotelName || "Rubikiai Lux",
          hotelContactEmail: body.data.hotelContactEmail || "info@rubikiailux.lt",
          hotelContactPhone: body.data.hotelContactPhone || "",
          logoCid,
        });
        break;
      }

      case "owner_reservation_notification": {
        const d = body.data;
        subject = `New reservation: ${d.reservationId}`;
        // importa la plantilla:
        const { OwnerReservationNotificationEmailHtmlEN } = await import(
          "@/app/[locale]/emails/OwnerReservationNotificationEmailHtmlEN"
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
          "@/app/[locale]/emails/OwnerCouponPurchaseEmailHtmlEN"
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
          variant = "B",
          notes,
        } = body.data;

        // Get subject line for this locale
        subject = getEmailSubject('booking-reminder', locale, { houseName });

        // Get and call the appropriate template function
        const templateFn = await getBookingReminderTemplate(locale);

        html = templateFn({
          guestName,
          houseName,
          checkIn,
          checkOut,
          nGuests,
          variant,
          notes,
          logoCid,
        });

        break;
      }

      default:
        return NextResponse.json(
          { error: t('invalidEmailType') },
          { status: 400 }
        );
    }

    const fromDisplay = body.fromName
      ? `${body.fromName} <noreply@rubikiailux.lt>`
      : "Rubikiai Lux <noreply@rubikiailux.lt>";

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
