// app/admin/bookings/page.tsx
import { cookies } from "next/headers";
import { Suspense } from "react";
import admin from "@/lib/firebase-admin";
import { redirect } from "next/navigation";
import AdminBookingsClient from "./ui/AdminBookingsClient";

// Forzar renderizado dinámico
export const dynamic = 'force-dynamic';

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

// Loading fallback
function AdminBookingsLoading() {
  return (
    <main className="min-h-screen pt-24 bg-[var(--color-background-main)]">
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="bg-white border rounded-xl p-4 space-y-4">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function AdminBookingsPage() {
  await requireAdmin();
  
  return (
    <Suspense fallback={<AdminBookingsLoading />}>
      <AdminBookingsClient />
    </Suspense>
  );
}