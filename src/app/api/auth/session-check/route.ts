// app/api/auth/session-check/route.ts
import admin from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export async function GET() {
  const session = (await cookies()).get("session")?.value;
  if (!session) {
    return Response.json({ isAuthenticated: false }, { status: 200 });
  }
  try {
    const decoded = await admin.auth().verifySessionCookie(session, true);
    const isAdmin = !!(decoded as any)?.admin;
    return Response.json({
      isAuthenticated: true,
      isAdmin,
      email: decoded.email ?? null,
      uid: decoded.uid ?? null,
    });
  } catch {
    return Response.json({ isAuthenticated: false }, { status: 200 });
  }
}
