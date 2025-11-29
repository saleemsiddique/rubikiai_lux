// app/reservations/cancel/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';

export default function Page() {
  const t = useTranslations('payment');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const reservationId = searchParams.get('reservationId');

  return (
    <main className="min-h-screen mt-16 sm:mt-0 flex items-center justify-center" style={{ background: "var(--color-background-main)" }}>
      <div className="max-w-3xl w-full mx-4 p-10 rounded-2xl shadow-lg" style={{ background: "white", borderRadius: 18 }}>
        <div className="flex flex-col items-center text-center gap-6">
          {/* Icon */}
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,230,225,0.6)" }}
          >
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="11" stroke="#e38b7a" strokeWidth="1.5" fill="none" />
              <path d="M8.5 8.5 L15.5 15.5 M15.5 8.5 L8.5 15.5" stroke="#e0553b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold" style={{ color: "var(--color-text)" }}>
            {t('cancelled')}
          </h1>

          <p className="max-w-xl text-sm md:text-base" style={{ color: "var(--color-text)" }}>
            {t('paymentNotCompleted')}
            {reservationId ? (
              <><br />{t('reservationId')} <span className="font-mono" style={{ color: "var(--color-highlight)" }}>{reservationId}</span></>
            ) : null}
          </p>

          <div className="w-full flex justify-center mt-2">
            <Link href={`/${locale}/reservations`} className="block">
              <button
                className="w-full py-3 px-4 rounded-lg font-semibold"
                style={{
                  background: "var(--color-primary)",
                  color: "white",
                }}
              >
                {t('tryAgain')}
              </button>
            </Link>

            <p>
              {t('needHelp')}{" "}
              <Link
                href={`/${locale}/contact`}
                style={{ color: "var(--color-primary-dark)", fontWeight: 600 }}
              >
                {t('contactUs')}
              </Link>
            </p>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            <p style={{ color: "var(--color-text)" }}>{t('paymentProcessed')}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
