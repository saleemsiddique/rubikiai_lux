// app/api/auth/session-login/route.ts
import admin from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { getTranslations } from 'next-intl/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  try {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'api.errors' });
    const { idToken, remember } = await req.json();
    if (!idToken) return new Response(t('missingIdToken'), { status: 400 });

    // 4h por defecto; 14 días con "remember"
    const expiresIn = remember ? 60 * 60 * 24 * 14 * 1000 : 60 * 60 * 4 * 1000;
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });

    (await cookies()).set({
      name: "session",
      value: sessionCookie,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresIn / 1000),
    });

    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(e?.message ?? t('sessionError'), { status: 400 });
  }
}
