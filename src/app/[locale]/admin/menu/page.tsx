import Link from "next/link";
import { cookies } from "next/headers";
import admin from "@/lib/firebase-admin";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import SearchParamsSection from "./SeatchParamsSection";

async function requireAdmin() {
  const session = (await cookies()).get("session")?.value;
  if (!session) redirect("/admin?reason=login");

  try {
    const decoded = await admin.auth().verifySessionCookie(session, false);
    if (!(decoded as any).admin) redirect("/admin?reason=forbidden");
    return decoded;
  } catch {
    redirect("/admin?reason=expired");
  }
}

export default async function AdminMenuPage() {
  const user = await requireAdmin();
  const t = await getTranslations("admin");

  return (
    <main className="min-h-screen pt-24 bg-[var(--color-background-main)]">
      <section className="max-w-5xl mx-auto px-6 py-12">

        {/* CLIENT COMPONENT envuelto en Suspense */}
        <Suspense fallback={<div className="text-xs text-neutral-400 mb-4">Loading params...</div>}>
          <SearchParamsSection />
        </Suspense>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">
            {t("menu.title")}
          </h1>

          {/* Logout seguro SSR */}
          <form action="/api/auth/session-logout" method="POST">
            <button
              type="submit"
              className="rounded-md border px-3 py-2 text-sm bg-white hover:bg-neutral-50"
            >
              {t("common.closedSession")}
            </button>
          </form>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/admin/bookings" className="rounded-xl border p-4 bg-white hover:bg-neutral-50">
            <div className="font-semibold">{t("menu.reservations")}</div>
            <div className="text-xs text-neutral-600">{t("menu.reservationsDesc")}</div>
          </Link>

          <Link href="/admin/coupons" className="rounded-xl border p-4 bg-white hover:bg-neutral-50">
            <div className="font-semibold">{t("menu.coupons")}</div>
            <div className="text-xs text-neutral-600">{t("menu.couponsDesc")}</div>
          </Link>

          <Link href="/admin/discounts" className="rounded-xl border p-4 bg-white hover:bg-neutral-50">
            <div className="font-semibold">{t("menu.discounts")}</div>
            <div className="text-xs text-neutral-600">{t("menu.discountsDesc")}</div>
          </Link>

          <Link href="/admin/revenue" className="rounded-xl border p-4 bg-white hover:bg-neutral-50">
            <div className="font-semibold">{t("menu.revenue")}</div>
            <div className="text-xs text-neutral-600">{t("menu.revenueDesc")}</div>
          </Link>

          <Link href="/admin/houses" className="rounded-xl border p-4 bg-white hover:bg-neutral-50">
            <div className="font-semibold">{t("menu.houses")}</div>
            <div className="text-xs text-neutral-600">{t("menu.housesDesc")}</div>
          </Link>
        </div>

        <div className="mt-8 text-xs text-neutral-500">
          {t("menu.sessionOf")}{" "}
          <span className="font-medium">
            {(user as any).email ?? (user as any).uid}
          </span>
        </div>

      </section>
    </main>
  );
}
