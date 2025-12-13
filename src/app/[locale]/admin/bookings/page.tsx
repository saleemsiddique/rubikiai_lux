// app/admin/bookings/page.tsx
import { cookies } from "next/headers";
import admin from "@/lib/firebase-admin";
import { redirect } from "next/navigation";
import AdminBookingsClient from "./ui/AdminBookingsClient";

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

export default async function AdminBookingsPage() {
  await requireAdmin();
  return <AdminBookingsClient />;
}
