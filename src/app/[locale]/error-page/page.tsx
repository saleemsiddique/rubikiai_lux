// app/…/page.tsx
import React, { Suspense } from "react";
import GenericErrorClient from "./ErrorPageClient";

export const metadata = {
  title: "Error",
};

export default function GenericErrorPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-xl w-full">
        <Suspense
          fallback={
            <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-full bg-yellow-100 text-yellow-700">
                  {/* icon placeholder */}
                  !
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">Loading…</h1>
                  <p className="text-sm text-gray-600">Preparing error details…</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 py-3 rounded-lg bg-[var(--color-primary)] text-white font-semibold text-center">Back</div>
              </div>
            </div>
          }
        >
          <GenericErrorClient />
        </Suspense>
      </div>
    </main>
  );
}
