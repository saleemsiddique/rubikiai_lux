// app/coupons/montonio/return/page.tsx
import React from "react";
import ReturnClient from "./ReturnClient";

export const runtime = "edge" as const; // opcional, quita si no aplicable

export default function MontonioReturnPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <React.Suspense fallback={<div className="p-6">Comprobando estado del pago…</div>}>
        <ReturnClient />
      </React.Suspense>
    </div>
  );
}
