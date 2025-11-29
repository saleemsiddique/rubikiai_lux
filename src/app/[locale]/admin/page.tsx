// app/admin/page.tsx
import React, { Suspense } from "react";
import AdminLoginClient from "./AdminLoginClient";

export const metadata = {
  title: "Admin Login",
};

export default function AdminPage() {
  return (
    <main className="min-h-screen pt-24 bg-[var(--color-background-main)]">
      <section className="max-w-md mx-auto px-6 py-16">
        <Suspense
          fallback={
            <div className="bg-white rounded-2xl border p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">Admin Login</h1>
              <p className="mt-4 text-sm text-neutral-600">Loading…</p>
            </div>
          }
        >
          <AdminLoginClient />
        </Suspense>
      </section>
    </main>
  );
}
