/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Resend } from "resend";
import fs from "fs/promises";
import path from "path";
import { CouponPurchaseEmailHtmlEN } from "@/app/emails/CouponPurchaseEmailHtmlEN";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const resend = new Resend(process.env.RESEND_API_KEY);

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
      expiresAt: string; // ISO YYYY-MM-DD
      buyerEmail?: string | null;
    };
    lang?: "en" | "es";
    fromName?: string; // opcional: sobrescribe el nombre visible del remitente
  };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SendEmailBody;

    const accept = (await headers()).get("accept-language") ?? "";
    const lang: "en" | "es" = body.lang ?? (accept.toLowerCase().startsWith("en") ? "en" : "es");

    let subject: string;
    let html: string;

    // --- preparamos el CID del logo (inline attachment) ---
    const logoCid = "rubikiai-logo";
    const publicDir = path.join(process.cwd(), "public");
    const logoPath = path.join(publicDir, "rubikiai-logo.png");

    let logoAttachment:
      | {
        filename: string;
        content: string;        // <— en base64
        contentType?: string;
        contentId?: string;     // <— camelCase correcto
      }
      | undefined;

    try {
      const buf = await fs.readFile(logoPath);
      logoAttachment = {
        filename: "rubikiai-logo.png",
        content: buf.toString("base64"), // <— Base64 recomendado
        contentType: "image/png",
        contentId: logoCid,              // <— ¡esta es la clave!
      };
    } catch {
      logoAttachment = undefined;
    }


    switch (body.type) {
      case "coupon_purchase": {
        const { unitAmount, quantity, currency = "EUR", codes, expiresAt } = body.data;
        subject = lang === "en" ? "Your Rubikiai Lux coupon(s)" : "Tus cupones de Rubikiai Lux";

        // Usamos el mismo template EN (si quieres, puedes crear variante ES con copy traducido)
        html = CouponPurchaseEmailHtmlEN({
          unitAmount,
          quantity,
          currency,
          codes,
          expiresAt,
          logoCid, // << usamos CID en el HTML
        });
        break;
      }
      default:
        return NextResponse.json({ error: "Tipo de email no válido" }, { status: 400 });
    }

    const fromDisplay = body.fromName ? `${body.fromName} <noreply@culinarium.io>` : "Rubikiai Lux <noreply@culinarium.io>";

    const sendArgs: any = {
      from: fromDisplay,
      to: body.to,
      subject,
      html,
    };

    if (logoAttachment) {
      // Adjuntamos inline (CID). Resend mostrará el adjunto, y los clientes lo renderizan en <img src="cid:...">
      sendArgs.attachments = [logoAttachment];
    }

    const { data, error } = await resend.emails.send(sendArgs);

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Error enviando email" }, { status: 500 });
  }
}
