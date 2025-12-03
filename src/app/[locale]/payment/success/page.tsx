// app/payment/success/page.tsx
"use client";

import React, { Suspense } from "react";
import { useTranslations } from 'next-intl';
import PaymentSuccessClient from "./PaymentSuccessClient";

function LoadingFallback() {
  const t = useTranslations('paymentPages');

  return (
    <div className="flex flex-col items-center text-center gap-6 p-8">
      <div className="animate-pulse">{t('verifyingPayment')}</div>
    </div>
  );
}

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
        <Suspense fallback={<LoadingFallback />}>
          <PaymentSuccessClient />
        </Suspense>
      </div>
    </main>
  );
}