// ============================================================
// app/payment/success/PaymentSuccessClient.tsx
// ============================================================
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from 'next-intl';

export default function PaymentSuccessClient() {
  const locale = useLocale();
  const t = useTranslations('paymentPages');
  const router = useRouter();
  const searchParams = useSearchParams();

  const merchantRef = searchParams?.get("ref") ?? undefined;
  const orderToken = searchParams?.get("order-token") ?? undefined;
  const cancelUrlParam = searchParams?.get("cancelUrl");

  const [loading, setLoading] = useState(true);
  const [reservationStatus, setReservationStatus] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 5; // 20 intentos = ~40 segundos

    const checkReservationStatus = async () => {
      if (!merchantRef) {
        router.replace(`/${locale}/cancel?reason=missing_reservation`);
        return;
      }

      try {
        const res = await fetch(
          `/${locale}/api/reservation-status?reservationId=${encodeURIComponent(merchantRef)}`
        );

        if (!res.ok) {
          // Si no existe aún, seguir esperando
          if (res.status === 404 && attempts < MAX_ATTEMPTS) {
            attempts++;
            return; // continuar polling
          }

          setError(t('couldNotVerifyReservation'));
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
          return;
        }

        const json = await res.json();
        const reservation = json.reservation as {
          status: "pending" | "reserved" | "expired" | "canceled";
          expiresAtIso?: string;
        };

        setReservationStatus(reservation.status);

        // Estados finales que detienen el polling
        if (
          reservation.status === "reserved" ||
          reservation.status === "canceled"
        ) {
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);

          if (reservation.status === "canceled") {
            router.replace(
              `/${locale}/cancel?reservationId=${merchantRef}&reason=payment_failed`
            );
          } else if (reservation.status === "reserved") {
            localStorage.removeItem("checkout-form-data");
            console.log("✅ Pago exitoso - datos del formulario eliminados");
          }
          return;
        }

        // Si está expirado
        if (reservation.status === "expired") {
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
          router.replace(`/${locale}/cancel?reservationId=${merchantRef}&reason=expired`);
          return;
        }

        // Verificar expiración por fecha
        if (reservation.expiresAtIso) {
          const expMs = new Date(reservation.expiresAtIso).getTime();
          if (expMs <= Date.now()) {
            setLoading(false);
            if (pollInterval) clearInterval(pollInterval);
            router.replace(
              `/${locale}/cancel?reservationId=${merchantRef}&reason=expired`
            );
            return;
          }
        }

        // Si llegamos al máximo de intentos sin confirmación
        if (attempts >= MAX_ATTEMPTS) {
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
          setError(t('confirmationTakingLonger'));
        }

        attempts++;
      } catch (err) {
        console.error("Error checking reservation status:", err);

        if (attempts >= MAX_ATTEMPTS) {
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
          setError(t('errorVerifyingReservation'));
        } else {
          attempts++;
        }
      }
    };

    // Primera verificación inmediata
    checkReservationStatus();

    // Polling cada 2 segundos
    pollInterval = setInterval(checkReservationStatus, 2000);

    // Cleanup
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [merchantRef, router]);

  useEffect(() => {
    if (orderToken) {
      // User came back from Montonio - validate payment status
      validateOrderToken(orderToken, cancelUrlParam);
    } else if (!merchantRef) {
      router.replace(`/${locale}/cancel?reason=missing_reservation`);
    }
    // Note: polling is handled by the first useEffect
  }, [orderToken, cancelUrlParam, merchantRef, router, locale]);

  const validateOrderToken = async (
    token: string,
    cancelUrl?: string | null
  ) => {
    try {
      const res = await fetch(`/${locale}/api/montonio/validate-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderToken: token }),
      });

      const result = await res.json();

      if (result.status === "PAID") {
        setReservationStatus("reserved");
        setLoading(false);
        localStorage.removeItem("checkout-form-data");
      } else {
        // Payment failed/cancelled/abandoned - redirect to cancel page
        const redirectUrl = cancelUrl || `/${locale}/cancel`;
        router.replace(redirectUrl);
      }
    } catch (error) {
      console.error("Order validation failed:", error);
      setError(t('errorValidatingPayment'));
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center text-center gap-6">
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center"
          style={{
            background: "linear-gradient(180deg, #ef4444/12, transparent)",
          }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle
              cx="12"
              cy="12"
              r="11"
              stroke="#ef4444"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M12 8v4m0 4h.01"
              stroke="#dc2626"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
          {t('verificationProblem')}
        </h1>

        <p className="max-w-xl text-sm md:text-base text-gray-700">{error}</p>

        <div className="w-full flex justify-center mt-2">
          <Link href={`/${locale}`}>
            <button
              className="w-full py-3 px-4 rounded-lg border font-semibold"
              style={{
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-dark)",
              }}
            >
              {t('backToHome')}
            </button>
          </Link>
        </div>

        <div className="text-xs text-gray-500 mt-3">
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
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center text-center gap-6">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[var(--color-primary)]"></div>
        <div className="text-lg font-medium text-gray-700">
          {t('verifyingPayment')}
        </div>
        <div className="text-sm text-gray-500">
          {t('mayTakeSeconds')}
        </div>
      </div>
    );
  }

  const idToShow = merchantRef ?? "";

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{
          background:
            "linear-gradient(180deg, var(--color-primary)/12, transparent)",
        }}
      >
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle
            cx="12"
            cy="12"
            r="11"
            stroke="var(--color-primary)"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M7 13l3 3 7-8"
            stroke="var(--color-primary-dark)"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1
        className="text-3xl md:text-4xl font-extrabold"
        style={{ color: "var(--color-text)" }}
      >
        {reservationStatus === "reserved"
          ? t('reservationConfirmed')
          : t('reservationInProgress')}
      </h1>

      <p
        className="max-w-xl text-sm md:text-base"
        style={{ color: "var(--color-text)" }}
      >
        {reservationStatus === "reserved"
          ? t('thanksForReservation')
          : t('paymentBeingProcessed')}
        {idToShow ? ` — ${t('id')} ` : ""}
        <span
          className="font-mono ml-1"
          style={{ color: "var(--color-highlight)" }}
        >
          {idToShow}
        </span>
      </p>

      <div className="w-full flex justify-center mt-2">
        <Link href={`/${locale}`} className="block">
          <button
            className="w-full py-3 px-4 rounded-lg border font-semibold"
            style={{
              borderColor: "var(--color-primary)",
              color: "var(--color-primary-dark)",
              background: "transparent",
            }}
          >
            {t('backToHome')}
          </button>
        </Link>
      </div>

      <div className="text-xs text-gray-500 mt-3">
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

      <div className="mt-4 w-full text-center text-xs text-gray-400">
        <p>
          {t('emailWithDetails')}
        </p>
      </div>
    </div>
  );
}
