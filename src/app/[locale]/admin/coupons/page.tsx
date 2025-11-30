// app/admin/coupons/page.tsx
import { cookies } from "next/headers";
import admin from "@/lib/firebase-admin";
import { redirect } from "next/navigation";
// ⬇️ IMPORTA DIRECTO EL CLIENT COMPONENT (sin next/dynamic)
import AdminCouponsClient from "./ui/AdminCouponsClient";
import Link from "next/link";
import { getTranslations } from 'next-intl/server';

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

export default async function AdminCouponsPage() {
  await requireAdmin();
  const t = await getTranslations('admin');

  return (
    <main className="min-h-screen pt-24 bg-[var(--color-background-main)]">
      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">{t('menu.coupons')}</h1>
          <Link
            href="/admin/menu"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            {t('common.back')}
          </Link>
        </div>

        {/* Client Component */}
        <AdminCouponsClient />
      </section>
    </main>
  );
}
