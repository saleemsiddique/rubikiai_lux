// app/coupons/montonio/return/ReturnClient.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from 'next-intl';
import Link from "next/link";

export default function ReturnClient() {
  const locale = useLocale();
  const t = useTranslations('paymentPages.montonioReturn');
  const search = useSearchParams();
  const router = useRouter();
  const orderId = search?.get("orderId") ?? null;
  const orderToken = search?.get("order-token") ?? search?.get("orderToken") ?? null;

  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tries, setTries] = useState(0);
  const [consumeResult, setConsumeResult] = useState<string | null>(null);

  // Force webhook processing with order-token
  useEffect(() => {
    if (!orderToken) return;
    let mounted = true;

    (async () => {
      try {
        setConsumeResult("sending");
        const endpoint = `/api/montonio/webhook?order-token=${encodeURIComponent(orderToken)}`;
        const res = await fetch(endpoint, { method: "POST" });
        if (!mounted) return;

        if (res.ok) {
          setConsumeResult("ok");
        } else {
          const text = await res.text().catch(() => "");
          console.error("Webhook consume returned", res.status, text);
          setConsumeResult(`error ${res.status}`);
        }
      } catch (e) {
        console.error("Failed to POST order-token to webhook:", e);
        if (mounted) setConsumeResult("network_error");
      }
    })();

    return () => { mounted = false; };
  }, [orderToken]);

  // Poll order status
  useEffect(() => {
    if (!orderId) return;
    let mounted = true;
    let intervalId: any = null;

    const check = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/${locale}/api/montonio/order-status?orderId=${encodeURIComponent(orderId)}`);

        if (!res.ok) {
          if (res.status === 404) {
            if (!mounted) return;
            setStatus("not_found");
            return;
          }
          const text = await res.text().catch(() => "");
          console.error("order-status error:", res.status, text);
          return;
        }

        const j = await res.json();
        if (!mounted) return;

        const s = (j.status || j.state || "pending").toString();
        setStatus(s);

        if (s === "completed") {
          // Clear interval and redirect to success
          if (intervalId) clearInterval(intervalId);
          router.replace(`/${locale}/coupons/success?orderId=${encodeURIComponent(orderId)}`);
        }
      } catch (e) {
        console.error("order-status fetch failed", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Initial check
    check();

    // Poll every 2 seconds
    intervalId = setInterval(() => {
      setTries((t) => t + 1);
      check();
    }, 2000);

    // Stop after 32 seconds
    const stopTimeout = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
    }, 32000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
      clearTimeout(stopTimeout);
    };
  }, [orderId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f4efe9' }}>
      <div className="p-8 max-w-2xl w-full bg-white rounded-xl shadow-xl">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">{t('title')}</h2>

        <p className="mb-4 text-gray-600">
          {t('order')} <span className="font-mono font-semibold text-gray-800">{orderId ?? "—"}</span>
        </p>

        {orderToken && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-800">
              {t('tokenDetected')}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {t('tokenStatus')} <span className="font-semibold">{consumeResult ?? t('pending')}</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 text-gray-600 mb-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
            <p className="text-sm">{t('checkingPaymentStatus', { tries })}</p>
          </div>
        )}

        {status === "completed" && (
          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <h3 className="font-semibold text-emerald-800">{t('paymentCompleted')}</h3>
            <p className="text-emerald-700 text-sm mt-1">
              {t('thankYouRedirecting')}
            </p>
          </div>
        )}

        {status === "processing" && (
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="font-semibold text-yellow-800">{t('paymentProcessing')}</h3>
            <p className="text-yellow-700 text-sm mt-1">
              {t('awaitingConfirmation')}
            </p>
          </div>
        )}

        {status === "pending" && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-800">{t('paymentPending')}</h3>
            <p className="text-blue-700 text-sm mt-1">
              {t('notifyByEmail')}
            </p>
          </div>
        )}

        {status === "canceled" && (
          <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
            <h3 className="font-semibold text-rose-800">{t('paymentCanceled')}</h3>
            <p className="text-rose-700 text-sm mt-1">
              {t('paymentNotCompleted')}
            </p>
          </div>
        )}

        {status === "not_found" && (
          <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
            <h3 className="font-semibold text-rose-800">{t('orderNotFound')}</h3>
            <p className="text-rose-700 text-sm mt-1">
              {t('orderNotFoundMessage')}
            </p>
          </div>
        )}

        {!status && !loading && (
          <p className="text-gray-600">{t('checkingStatus')}</p>
        )}

        <div className="mt-6 pt-6 border-t">
          <Link
            href={`/${locale}/coupons`}
            className="text-blue-600 hover:text-blue-800 underline font-medium"
          >
            {t('backToPurchase')}
          </Link>
        </div>
      </div>
    </div>
  );
}