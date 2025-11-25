// ============================================================
// app/payment/success/PaymentSuccessClient.tsx
// ============================================================
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function PaymentSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const merchantRef = searchParams?.get("ref") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [reservationStatus, setReservationStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // En tu página de success (ej: /checkout/success o similar)
  useEffect(() => {
    // Limpiar datos del formulario solo cuando el pago fue exitoso
    localStorage.removeItem("checkout-form-data");
  }, []);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 5; // 20 intentos = ~40 segundos

    const checkReservationStatus = async () => {
      if (!merchantRef) {
        router.replace(`/cancel?reason=missing_reservation`);
        return;
      }

      try {
        const res = await fetch(
          `/api/reservation-status?reservationId=${encodeURIComponent(merchantRef)}`
        );

        if (!res.ok) {
          // Si no existe aún, seguir esperando
          if (res.status === 404 && attempts < MAX_ATTEMPTS) {
            attempts++;
            return; // continuar polling
          }

          setError("No se pudo verificar el estado de la reserva");
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
        if (reservation.status === "reserved" || reservation.status === "canceled") {
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);

          if (reservation.status === "canceled") {
            router.replace(`/cancel?reservationId=${merchantRef}&reason=payment_failed`);
          }
          return;
        }

        // Si está expirado
        if (reservation.status === "expired") {
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
          router.replace(`/cancel?reservationId=${merchantRef}&reason=expired`);
          return;
        }

        // Verificar expiración por fecha
        if (reservation.expiresAtIso) {
          const expMs = new Date(reservation.expiresAtIso).getTime();
          if (expMs <= Date.now()) {
            setLoading(false);
            if (pollInterval) clearInterval(pollInterval);
            router.replace(`/cancel?reservationId=${merchantRef}&reason=expired`);
            return;
          }
        }

        // Si llegamos al máximo de intentos sin confirmación
        if (attempts >= MAX_ATTEMPTS) {
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
          setError("La confirmación está tardando más de lo esperado");
        }

        attempts++;
      } catch (err) {
        console.error("Error checking reservation status:", err);

        if (attempts >= MAX_ATTEMPTS) {
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
          setError("Error al verificar el estado de la reserva");
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

  if (error) {
    return (
      <div className="flex flex-col items-center text-center gap-6">
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(180deg, #ef4444/12, transparent)" }}
        >
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="11" stroke="#ef4444" strokeWidth="1.5" fill="none" />
            <path d="M12 8v4m0 4h.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
          Problema con la verificación
        </h1>

        <p className="max-w-xl text-sm md:text-base text-gray-700">
          {error}
        </p>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <Link href={`/reservations?reservationId=${encodeURIComponent(merchantRef || "")}`}>
            <button
              className="w-full py-3 rounded-lg font-semibold"
              style={{
                background: "var(--color-primary)",
                color: "white",
              }}
            >
              Ver mis reservas
            </button>
          </Link>

          <Link href="/">
            <button
              className="w-full py-3 rounded-lg border font-semibold"
              style={{
                borderColor: "var(--color-primary)",
                color: "var(--color-primary-dark)",
              }}
            >
              Volver al inicio
            </button>
          </Link>
        </div>

        <div className="text-xs text-gray-500 mt-3">
          <p>
            ¿Necesitas ayuda?{" "}
            <a
              href="mailto:hello@rubikiai.com"
              style={{ color: "var(--color-primary-dark)", fontWeight: 600 }}
            >
              Contáctanos
            </a>
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
          Verificando el pago con Montonio…
        </div>
        <div className="text-sm text-gray-500">
          Esto puede tardar unos segundos
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
          background: "linear-gradient(180deg, var(--color-primary)/12, transparent)",
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
          ? "¡Reserva confirmada!"
          : "Reserva en proceso"}
      </h1>

      <p
        className="max-w-xl text-sm md:text-base"
        style={{ color: "var(--color-text)" }}
      >
        {reservationStatus === "reserved"
          ? `Gracias por tu reserva en Rubikiai. Hemos recibido tu pago y tu reserva está confirmada.`
          : `Tu pago está siendo procesado. Recibirás un e-mail cuando la reserva esté confirmada.`}
        {idToShow ? " — ID: " : ""}
        <span
          className="font-mono ml-1"
          style={{ color: "var(--color-highlight)" }}
        >
          {idToShow}
        </span>
      </p>

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        <Link
          href={`/reservations?reservationId=${encodeURIComponent(idToShow)}`}
          className="block"
        >
          <button
            className="w-full py-3 rounded-lg font-semibold"
            style={{
              background: "var(--color-primary)",
              color: "white",
              boxShadow: "0 6px 18px rgba(143,110,82,0.12)",
            }}
          >
            Ver mis reservas
          </button>
        </Link>

        <Link href="/" className="block">
          <button
            className="w-full py-3 rounded-lg border font-semibold"
            style={{
              borderColor: "var(--color-primary)",
              color: "var(--color-primary-dark)",
              background: "transparent",
            }}
          >
            Volver al inicio
          </button>
        </Link>
      </div>

      <div className="text-xs text-gray-500 mt-3">
        <p style={{ color: "var(--color-text)" }}>
          ¿Necesitas ayuda?{" "}
          <a
            href="mailto:hello@rubikiai.com"
            style={{ color: "var(--color-primary-dark)", fontWeight: 600 }}
          >
            Contáctanos
          </a>
        </p>
      </div>

      <div className="mt-4 w-full text-center text-xs text-gray-400">
        <p>
          Recibirás un e-mail con los detalles. Guarda el ID de reserva para
          cualquier incidencia.
        </p>
      </div>
    </div>
  );
}