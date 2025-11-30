// app/coupons/cancel/CancelClient.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from 'next-intl';

export default function CancelClient() {
  const locale = useLocale();
  const t = useTranslations('paymentPages');
  const searchParams = useSearchParams();
  const orderId = searchParams?.get("orderId") ?? undefined;
  const reason = (searchParams?.get("reason") ?? "cancelled").toLowerCase();

  const { title, message } = getCopy(reason, t);

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{ background: "linear-gradient(180deg, var(--color-primary)/12, transparent)" }}
      >
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="11" stroke="var(--color-primary)" strokeWidth="1.5" fill="none" />
          <path d="M8 8l8 8M16 8l-8 8" stroke="var(--color-primary-dark)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="text-3xl md:text-4xl font-extrabold" style={{ color: "var(--color-text)" }}>
        {title}
      </h1>

      <p className="max-w-xl text-sm md:text-base" style={{ color: "var(--color-text)" }}>
        {message}
        {orderId ? ` — ${t('orderId')} ` : ""}
        {orderId && <span className="font-mono ml-1" style={{ color: "var(--color-highlight)" }}>{orderId}</span>}
      </p>

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        <Link href={`/${locale}/coupons`} className="block">
          <button
            className="w-full py-3 rounded-lg font-semibold"
            style={{
              background: "var(--color-primary)",
              color: "white",
              boxShadow: "0 6px 18px rgba(143,110,82,0.12)",
            }}
          >
            {t('tryAgain')}
          </button>
        </Link>

        <Link href={`/${locale}`} className="block">
          <button
            className="w-full py-3 rounded-lg border font-semibold"
            style={{ borderColor: "var(--color-primary)", color: "var(--color-primary-dark)", background: "transparent" }}
          >
            {t('backToHome')}
          </button>
        </Link>
      </div>

      <div className="text-xs text-gray-500 mt-3">
        <p style={{ color: "var(--color-text)" }}>
          {t('needHelp')}{" "}
          <Link
            href={`/${locale}/contact`}
            className="inline-block"
            style={{ color: "var(--color-primary-dark)", fontWeight: 600 }}
          >
            {t('contactUs')}
          </Link>
        </p>
      </div>

      <div className="mt-4 w-full text-center text-xs text-gray-400">
        <p>{t('noChargeInfo')}</p>
      </div>
    </div>
  );
}

function getCopy(reason: string, t: any) {
  switch (reason) {
    case "missing_order":
      return {
        title: t('orderNotFound'),
        message: t('orderNotFoundMessage'),
      };
    case "not_found":
      return {
        title: t('orderNotFound'),
        message: t('orderDoesNotExist'),
      };
    case "expired":
      return {
        title: t('checkoutExpired'),
        message: t('sessionExpiredMessage'),
      };
    case "no_payment_intent":
      return {
        title: t('paymentNotVerified'),
        message: t('paymentNotVerifiedMessage'),
      };
    case "pi_status":
      return {
        title: t('paymentNotCompleted'),
        message: t('paymentNotCompletedMessage'),
      };
    case "error":
      return {
        title: t('problemOccurred'),
        message: t('somethingWentWrong'),
      };
    case "server_error":
      return {
        title: t('serverError'),
        message: t('unexpectedError'),
      };
    case "cancelled":
    default:
      return {
        title: t('paymentCanceled'),
        message: t('paymentCanceledMessage'),
      };
  }
}
