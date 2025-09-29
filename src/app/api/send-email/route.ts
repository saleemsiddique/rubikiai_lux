/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Resend } from "resend";
import { CouponPurchaseEmailHtmlEN } from "@/app/emails/CouponPurchaseEmailHtmlES";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const resend = new Resend(process.env.RESEND_API_KEY);

// CENTRAL EMAIL ROUTE
// Tipos soportados. Añade más aquí a futuro.
export type SendEmailBody =
  | {
      type: "coupon_purchase";
      to: string | string[];
      data: {
        unitAmount: number;
        quantity: number;
        currency?: string;
        codes: { code: string; remaining: number }[];
        expiresAt: string; // ISO date string
        buyerEmail?: string | null;
      };
      lang?: "en" | "es";
      fromName?: string; // overrides default display name
    };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SendEmailBody;

    const accept = (await headers()).get("accept-language") ?? "";
    const lang: "en" | "es" = body.lang ?? (accept.toLowerCase().startsWith("en") ? "en" : "es");

    let subject: string;
    let html: string;

    switch (body.type) {
      case "coupon_purchase": {
        const { unitAmount, quantity, currency = "EUR", codes, expiresAt } = body.data;
        subject = lang === "en" ? "Your Rubikiai Lux coupon(s)" : "Tus cupones de Rubikiai Lux";
        html = lang === "en"
          ? CouponPurchaseEmailHtmlEN({ unitAmount, quantity, currency, codes, expiresAt })
          : CouponPurchaseEmailHtmlEN({ unitAmount, quantity, currency, codes, expiresAt });
        break;
      }
      default:
        return NextResponse.json({ error: "Tipo de email no válido" }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: "Rubikiai Lux <noreply@culinarium.io>",
      to: body.to,
      subject,
      html,
    });

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Error enviando email" }, { status: 500 });
  }
}
