// app/api/auth/session-logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  // Borrar la cookie de sesión
  (await
        // Borrar la cookie de sesión
        cookies()).set({
    name: "session",
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  // Redirigir al login de admin
  const url = new URL("/admin", req.url);
  return NextResponse.redirect(url, { status: 303 });
}

// (opcional) Soporte GET por si usas enlace en vez de <form method="POST">
export async function GET(req: Request) {
  (await cookies()).set({
    name: "session",
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  const url = new URL("/admin", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
