// app/payment/success/page.tsx
import React, { Suspense } from "react";
import PaymentSuccessClient from "./PaymentSuccessClient";

export const metadata = {
  title: "Payment Status - Montonio",
};

export default function PaymentSuccessPage() {
  return (
    <main 
      className="min-h-screen mt-16 sm:mt-0 flex items-center justify-center" 
      style={{ background: "var(--color-background-main)" }}
    >
      <div 
        className="max-w-3xl w-full mx-4 p-10 rounded-2xl shadow-lg" 
        style={{ background: "white", borderRadius: 18 }}
      >
        <Suspense
          fallback={
            <div className="flex flex-col items-center text-center gap-6 p-8">
              <div className="animate-pulse">Verificando estado del pago…</div>
            </div>
          }
        >
          <PaymentSuccessClient />
        </Suspense>
      </div>
    </main>
  );
}