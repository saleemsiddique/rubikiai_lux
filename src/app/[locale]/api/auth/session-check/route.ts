// app/api/auth/session-check/route.ts
import admin from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export async function GET() {
  const session = (await cookies()).get("session")?.value;
  console.log("[session-check] Cookie session:", session ? "presente (longitud: " + session.length + ")" : "ausente");

  if (!session) {
    console.log("[session-check] No hay cookie, retornando no autenticado");
    return Response.json({ isAuthenticated: false }, { status: 200 });
  }
  try {
    const decoded = await admin.auth().verifySessionCookie(session, false);
    const isAdmin = !!(decoded as any)?.admin;
    console.log("[session-check] Token válido, isAdmin:", isAdmin, "email:", decoded.email);
    return Response.json({
      isAuthenticated: true,
      isAdmin,
      email: decoded.email ?? null,
      uid: decoded.uid ?? null,
    });
  } catch (e) {
    console.log("[session-check] Error verificando token:", e);
    return Response.json({ isAuthenticated: false }, { status: 200 });
  }
}
