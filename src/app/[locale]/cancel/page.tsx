"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useTranslations, useLocale, useLocale as nextIntlUseLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';

function CancelContent() {
  const t = useTranslations('payment');
  const locale = nextIntlUseLocale();
  const searchParams = useSearchParams();
  const reservationId = searchParams.get('reservationId');

  return (
    <>
      {/* Icon */}
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,230,225,0.6)" }}
      >
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="11" stroke="#e38b7a" strokeWidth="1.5" fill="none" />
          <path
            d="M8.5 8.5 L15.5 15.5 M15.5 8.5 L8.5 15.5"
            stroke="#e0553b"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text)]">
        {t('cancelled')}
      </h1>

      <p className="max-w-xl text-sm md:text-base text-[var(--color-text)]">
        {t('paymentNotCompleted')}
        {reservationId && (
          <>
            <br />
            {t('reservationId')} <span className="font-mono text-[var(--color-highlight)]">{reservationId}</span>
          </>
        )}
      </p>

      <div className="w-full flex flex-col items-center gap-4 mt-2">
        <Link href={`/${locale}/reservations`} className="w-full sm:w-auto">
          <button
            className="w-full py-3 px-4 rounded-lg font-semibold"
            style={{ background: "var(--color-primary)", color: "white" }}
          >
            {t('tryAgain')}
          </button>
        </Link>

        <p className="text-sm mt-2">
          {t('needHelp')}{" "}
          <Link
            href={`/${locale}/contact`}
            className="text-[var(--color-primary-dark)] font-semibold underline"
          >
            {t('contactUs')}
          </Link>
        </p>
      </div>

      <div className="mt-4 text-xs text-[var(--color-text)] opacity-60">
        {t('paymentProcessed')}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <main className="min-h-screen mt-16 sm:mt-0 flex items-center justify-center bg-[var(--color-background-main)]">
      <div className="max-w-3xl w-full mx-4 p-10 rounded-[18px] shadow-lg bg-white">
        <div className="flex flex-col items-center text-center gap-6">
          <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
            <CancelContent />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
