// app/reservations/thanks/ReservationsThanksClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function ReservationsThanksClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const reservationId = searchParams?.get("reservationId") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [reservationStatus, setReservationStatus] = useState<string | null>(null);

  // En tu página de success (ej: /checkout/success o similar)
  useEffect(() => {
    // Limpiar datos del formulario solo cuando el pago fue exitoso
    localStorage.removeItem("checkout-form-data");
  }, []);

  useEffect(() => {
    (async () => {
      if (!reservationId) {
        router.replace(`/cancel?reason=missing_reservation`);
        return;
      }
      try {
        const res = await fetch(`/api/reservation-status?reservationId=${encodeURIComponent(reservationId)}`);
        if (!res.ok) {
          router.replace(`/cancel?reservationId=${reservationId}&reason=not_found`);
          return;
        }
        const json = await res.json();
        const reservation = json.reservation as { status: "pending" | "reserved" | "expired"; expiresAtIso?: string };

        setReservationStatus(reservation.status);

        if (reservation.status === "expired") {
          router.replace(`/cancel?reservationId=${reservationId}&reason=expired`);
          return;
        }

        if (reservation.expiresAtIso) {
          const expMs = new Date(reservation.expiresAtIso).getTime();
          if (expMs <= Date.now()) {
            router.replace(`/cancel?reservationId=${reservationId}&reason=expired`);
            return;
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Error checking reservation status:", err);
        router.replace(`/cancel?reservationId=${reservationId}&reason=server_error`);
      }
    })();
    // depend on reservationId and router (router is stable from next/navigation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center text-center gap-6">
        <div>Comprobando estado de la reserva…</div>
      </div>
    );
  }

  const idToShow = reservationId ?? "";

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{ background: "linear-gradient(180deg, var(--color-primary)/12, transparent)" }}
      >
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="11" stroke="var(--color-primary)" strokeWidth="1.5" fill="none" />
          <path d="M7 13l3 3 7-8" stroke="var(--color-primary-dark)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="text-3xl md:text-4xl font-extrabold" style={{ color: "var(--color-text)" }}>
        {reservationStatus === "reserved" ? "¡Reserva confirmada!" : "Reserva en proceso"}
      </h1>

      <p className="max-w-xl text-sm md:text-base" style={{ color: "var(--color-text)" }}>
        {reservationStatus === "reserved"
          ? `Gracias por tu reserva en Rubikiai. Hemos recibido tu pago y tu reserva está confirmada.`
          : `Tu pago está siendo procesado. Recibirás un e-mail cuando la reserva esté confirmada.`}
        {idToShow ? " — ID: " : ""}
        <span className="font-mono ml-1" style={{ color: "var(--color-highlight)" }}>{idToShow}</span>
      </p>

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        <Link href="/" className="block">
          <button
            className="w-full py-3 rounded-lg border font-semibold"
            style={{ borderColor: "var(--color-primary)", color: "var(--color-primary-dark)", background: "transparent" }}
          >
            Volver al inicio
          </button>
        </Link>
      </div>

      <div className="text-xs text-gray-500 mt-3">
        <p>
          ¿Necesitas ayuda?{" "}
          <Link
            href="/contact"
            style={{ color: "var(--color-primary-dark)", fontWeight: 600 }}
          >
            Contáctanos
          </Link>
        </p>
      </div>

      <div className="mt-4 w-full text-center text-xs text-gray-400">
        <p>Recibirás un e-mail con los detalles. Guarda el ID de reserva para cualquier incidencia.</p>
      </div>
    </div>
  );
}
