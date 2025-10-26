// app/api/admin/discounts/create/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import admin, { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;
  if (!session) throw new Error("unauthorized");
  const decoded = await admin.auth().verifySessionCookie(session, true);
  if (!(decoded as any).admin) throw new Error("forbidden");
  return decoded;
}

// genera código estilo "ABCD-EFGH"
function makeCode(): string {
  const chunk = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${chunk()}-${chunk()}`;
}

// devuelve YYYY-MM-DD local sumando 12 meses
function addOneYearIsoLocal(): string {
  const now = new Date();
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  d.setFullYear(d.getFullYear() + 1); // +1 año
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => ({}));
    const toEmail = String(body.toEmail || "").trim().toLowerCase();
    const percent = Number(body.percent);

    // validaciones
    if (!toEmail) {
      return NextResponse.json({ error: "Missing toEmail" }, { status: 400 });
    }
    if (!Number.isInteger(percent) || percent <= 0 || percent > 100) {
      return NextResponse.json(
        { error: "Invalid percent (must be integer 1..100)" },
        { status: 400 }
      );
    }

    // generar code y expiresAt en backend
    const code = makeCode();
    const expiresAt = addOneYearIsoLocal();

    // Guardar en Firestore
    // Colección nueva clara para NO mezclar con cupones de saldo €
    const ref = adminDb.collection("percentage_discounts").doc();
    const nowTs = admin.firestore.Timestamp.now();

    const payload = {
      code,
      type: "percent", // para distinguirlo en backoffice
      percent,
      expiresAt, // YYYY-MM-DD string
      used: false,
      sentTo: toEmail,
      createdAt: nowTs,
      lastSentAt: nowTs,
    };

    await ref.set(payload);

    // Enviar email usando /api/send-email (tipo discount_code)
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${(process.env.VERCEL_URL ||
            process.env.NEXT_PUBLIC_APP_URL!
              .replace(/^https?:\/\//, "")) as string}`
        : "http://localhost:3000";

    const emailRes = await fetch(`${baseUrl}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "discount_code",
        to: toEmail,
        data: {
          code,
          percent,
          expiresAt,
        },
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("discount_code email send failed:", errText);
      // registramos que falló el envío
      await ref.update({
        emailSendError: errText,
        emailSendErrorAt: admin.firestore.Timestamp.now(),
      });
      return NextResponse.json({
        ok: true,
        warning: "discount saved but email failed",
        id: ref.id,
        code,
        expiresAt,
      });
    }

    // todo ok
    return NextResponse.json({
      ok: true,
      id: ref.id,
      code,
      expiresAt,
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
