// app/coupons/cancel/page.tsx
import React, { Suspense } from "react";
import CancelClient from "./CancelClient";

export const metadata = {
  title: "Payment cancelled",
};

export default function CancelPage() {
  return (
    <main className="min-h-screen mt-16 sm:mt-0 flex items-center justify-center" style={{ background: "var(--color-background-main)" }}>
      <div className="max-w-3xl w-full mx-4 p-10 rounded-2xl shadow-lg" style={{ background: "white", borderRadius: 18 }}>
        <Suspense
          fallback={
            <div className="flex flex-col items-center text-center gap-6 p-8">
              <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(180deg, var(--color-primary)/12, transparent)" }} />
              <h1 className="text-2xl font-bold">Processing…</h1>
              <p className="text-sm text-neutral-600">Loading cancellation details…</p>
            </div>
          }
        >
          <CancelClient />
        </Suspense>
      </div>
    </main>
  );
}
