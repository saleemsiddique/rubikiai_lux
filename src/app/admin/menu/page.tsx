// app/admin/menu/page.tsx
import { cookies } from "next/headers";
import admin from "@/lib/firebase-admin";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value; // sin await
  if (!session) redirect("/admin?reason=login");
  try {
    const decoded = await admin.auth().verifySessionCookie(session, true);
    if (!(decoded as any).admin) redirect("/admin?reason=forbidden");
    return decoded;
  } catch {
    redirect("/admin?reason=expired");
  }
}


export default async function AdminMenuPage() {
  const user = await requireAdmin();

  return (
    <main className="min-h-screen pt-24 bg-[var(--color-background-main)]">
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">Admin · Menu</h1>
          <form action="/api/auth/session-logout" method="POST">
            <button className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50">Cerrar sesión</button>
          </form>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <a href="/admin/bookings" className="rounded-xl border p-4 bg-white hover:bg-neutral-50">
            <div className="font-semibold">Reservas</div>
            <div className="text-xs text-neutral-600">Gestiona las reservas</div>
          </a>
          <a href="/admin/coupons" className="rounded-xl border p-4 bg-white hover:bg-neutral-50">
            <div className="font-semibold">Cupones</div>
            <div className="text-xs text-neutral-600">Crea y edita códigos</div>
          </a>
          <a href="/admin/houses" className="rounded-xl border p-4 bg-white hover:bg-neutral-50">
            <div className="font-semibold">Alojamientos</div>
            <div className="text-xs text-neutral-600">Precios, disponibilidad, etc.</div>
          </a>
        </div>

        <div className="mt-8 text-xs text-neutral-500">
          Sesión de: <span className="font-medium">{(user as any).email ?? (user as any).uid}</span>
        </div>
      </section>
    </main>
  );
}
