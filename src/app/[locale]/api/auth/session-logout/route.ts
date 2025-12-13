// app/api/auth/session-logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  console.log("[session-logout] POST recibido");

  // Borrar la cookie de sesión
  const cookieStore = await cookies();
  const hadSession = cookieStore.get("session")?.value;
  console.log("[session-logout] Cookie antes de borrar:", hadSession ? "presente" : "ausente");

  cookieStore.delete("session");
  console.log("[session-logout] Cookie borrada");

  // Redirigir al login de admin con parámetro logout
  const url = new URL("/admin", req.url);
  url.searchParams.set("reason", "logout");
  console.log("[session-logout] Redirigiendo a:", url.toString());
  return NextResponse.redirect(url, { status: 303 });
}

// (opcional) Soporte GET por si usas enlace en vez de <form method="POST">
export async function GET(req: Request) {
  const cookieStore = await cookies();
  cookieStore.delete("session");

  const url = new URL("/admin", req.url);
  url.searchParams.set("reason", "logout");
  return NextResponse.redirect(url, { status: 303 });
}
