// app/admin/bookings/page.tsx
import { cookies } from "next/headers";
import admin from "@/lib/firebase-admin";
import { redirect } from "next/navigation";
import AdminBookingsClient from "./ui/AdminBookingsClient";

async function requireAdmin(locale: string) {
  const session = (await cookies()).get("session")?.value;
  if (!session) redirect(`/${locale}/admin?reason=login`);
  try {
    const decoded = await admin.auth().verifySessionCookie(session, false);
    if (!(decoded as any).admin) redirect(`/${locale}/admin?reason=forbidden`);
    return decoded;
  } catch {
    redirect(`/${locale}/admin?reason=expired`);
  }
}

export default async function AdminBookingsPage() {
  const { getLocale } = await import('next-intl/server');
  const locale = await getLocale();
  await requireAdmin(locale);
  return <AdminBookingsClient />;
}
