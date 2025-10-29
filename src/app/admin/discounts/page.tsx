// app/admin/discounts/page.tsx
import { cookies } from "next/headers";
import admin from "@/lib/firebase-admin";
import { redirect } from "next/navigation";
import AdminDiscountsClient from "@/app/admin/discounts/AdminDiscountsClient";

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;
  if (!session) redirect("/admin?reason=login");
  try {
    const decoded = await admin.auth().verifySessionCookie(session, true);
    if (!(decoded as any).admin) redirect("/admin?reason=forbidden");
    return decoded;
  } catch {
    redirect("/admin?reason=expired");
  }
}

export default async function AdminDiscountsPage() {
  const user = await requireAdmin();

  return (
    <main className="min-h-screen pt-24 bg-[var(--color-background-main)]">
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">
            Enviar código de % descuento
          </h1>
          <a
            href="/admin/menu"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Volver al menú
          </a>
        </div>

        {/* cliente */}
        <AdminDiscountsClient
          adminEmail={(user as any).email ?? (user as any).uid ?? ""}
        />
      </section>
    </main>
  );
}
