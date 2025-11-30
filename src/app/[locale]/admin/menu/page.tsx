import Link from "next/link";
import { cookies } from "next/headers";
import admin from "@/lib/firebase-admin";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;
  if (!session) {
    redirect("/admin?reason=login");
  }

  try {
    const decoded = await admin.auth().verifySessionCookie(session, true);
    if (!(decoded as any).admin) {
      redirect("/admin?reason=forbidden");
    }
    return decoded;
  } catch {
    redirect("/admin?reason=expired");
  }
}

export default async function AdminMenuPage() {
  const user = await requireAdmin();

  async function logout() {
    "use server";
    redirect("/api/auth/session-logout");
  }

  return (
    <main className="min-h-screen pt-24 bg-[var(--color-background-main)]">
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">
            Admin · Menu
          </h1>

          {/* Logout con petición POST */}
          <button
            onClick={logout}
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/admin/bookings"
            className="rounded-xl border p-4 bg-white hover:bg-neutral-50"
          >
            <div className="font-semibold">Reservas</div>
            <div className="text-xs text-neutral-600">Gestiona las reservas</div>
          </Link>

          <Link
            href="/admin/coupons"
            className="rounded-xl border p-4 bg-white hover:bg-neutral-50"
          >
            <div className="font-semibold">Cupones saldo €</div>
            <div className="text-xs text-neutral-600">Crea y edita bonos regalo</div>
          </Link>

          <Link
            href="/admin/discounts"
            className="rounded-xl border p-4 bg-white hover:bg-neutral-50"
          >
            <div className="font-semibold">% Descuentos directos</div>
            <div className="text-xs text-neutral-600">Enviar código personal con % y caducidad</div>
          </Link>

          <Link
            href="/admin/revenue"
            className="rounded-xl border p-4 bg-white hover:bg-neutral-50"
          >
            <div className="font-semibold">Ingresos</div>
            <div className="text-xs text-neutral-600">Reservas + cupones · exportar Excel</div>
          </Link>

          <Link
            href="/admin/houses"
            className="rounded-xl border p-4 bg-white hover:bg-neutral-50"
          >
            <div className="font-semibold">Houses</div>
            <div className="text-xs text-neutral-600">Precios por día · info</div>
          </Link>
        </div>

        <div className="mt-8 text-xs text-neutral-500">
          Sesión de:{" "}
          <span className="font-medium">
            {(user as any).email ?? (user as any).uid}
          </span>
        </div>
      </section>
    </main>
  );
}
