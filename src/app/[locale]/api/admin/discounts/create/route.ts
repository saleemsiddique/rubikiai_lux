// app/api/admin/discounts/create/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import admin, { adminDb } from "@/lib/firebase-admin";
import { Resend } from "resend";
import fs from "fs/promises";
import path from "path";
import { DiscountCodeEmailHtml } from "@/app/[locale]/emails/DiscountCodeEmailHtml";
import { nowInLithuania } from "@/app/[locale]/utils/date-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// --- Resend client ---
const resend = new Resend(process.env.RESEND_API_KEY);

// genera códigos tipo "ABCD-EFGH"
function randomCode() {
  const chunk = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${chunk()}-${chunk()}`;
}

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;
  if (!session) throw new Error("unauthorized");
  const decoded = await admin.auth().verifySessionCookie(session, true);
  if (!(decoded as any).admin) throw new Error("forbidden");
  return decoded;
}

// helper: YYYY-MM-DD desde Date local
function toIsoDateOnly(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(req: Request) {
  try {
    const me = await requireAdmin();

    const body = await req.json().catch(() => ({}));
    const toEmail = String(body.toEmail || "").trim().toLowerCase();
    const percentRaw = body.percent;

    // validaciones de entrada mínimas
    if (!toEmail) {
      return NextResponse.json({ error: "Missing toEmail" }, { status: 400 });
    }

    // percent tiene que ser entero 1..100
    const percent = parseInt(String(percentRaw), 10);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      return NextResponse.json(
        { error: "Invalid percent (1-100 integer)" },
        { status: 400 }
      );
    }

    // generar código interno automáticamente
    const code = randomCode();

    // generar expiración = hoy + 12 meses
    const now = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + 12);
    const expiresAt = toIsoDateOnly(expires); // "YYYY-MM-DD"

    // timestamps Firestore
    const nowTs = nowInLithuania();

    // guardamos en colección separada para NO mezclar con 'coupons'
    const ref = adminDb.collection("percentage_discounts").doc();
    const payload = {
      code,
      type: "percent",
      percent,
      expiresAt,         // YYYY-MM-DD
      used: false,
      sentTo: toEmail,
      createdAt: nowTs,
      lastSentAt: nowTs,
      createdBy: (me as any).uid || null,
    };

    await ref.set(payload);

    // === Enviar email directo con Resend ===

    // 1. preparamos logo inline cid
    const logoCid = "rubikiai-logo";
    let logoAttachment:
      | {
          filename: string;
          content: string;
          contentType?: string;
          contentId?: string;
        }
      | undefined;

    try {
      const publicDir = path.join(process.cwd(), "public");
      const logoPath = path.join(publicDir, "rubikiai-logo.png");
      const buf = await fs.readFile(logoPath);
      logoAttachment = {
        filename: "rubikiai-logo.png",
        content: buf.toString("base64"),
        contentType: "image/png",
        contentId: logoCid,
      };
    } catch {
      // si falla leer el logo, seguimos sin adjunto
      logoAttachment = undefined;
    }

    const html = DiscountCodeEmailHtml({
      code,
      percent,
      expiresAt,
      logoCid,
    });

    const subject = "Your personal discount for Rubikiai Lux";

    const { data, error } = await resend.emails.send({
      from: "Rubikiai Lux <noreply@rubikiai.lt>",
      to: toEmail,
      subject,
      html,
      attachments: logoAttachment ? [logoAttachment] : undefined,
    });

    if (error) {
      console.error("Resend error sending discount_code:", error);

      // anotamos error en el doc, pero NO deshacemos la creación
      await ref.update({
        emailSendError: String(error),
        emailSendErrorAt: nowInLithuania(),
      });

      return NextResponse.json({
        ok: true,
        warning: "discount saved but email failed",
        id: ref.id,
      });
    }

    return NextResponse.json({
      ok: true,
      id: ref.id,
      resendId: data?.id || null,
    });
  } catch (e: any) {
    console.error("[admin/discounts/create] error:", e);
    const msg = e?.message || "server_error";
    const code =
      msg === "unauthorized"
        ? 401
        : msg === "forbidden"
        ? 403
        : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
