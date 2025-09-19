// app/reservations/thanks/page.tsx
import React from "react";
import Link from "next/link";

export default function Page({ searchParams }: { searchParams?: { reservationId?: string } }) {
  const reservationId = searchParams?.reservationId;

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-background-main)" }}>
      <div className="max-w-3xl w-full mx-4 p-10 rounded-2xl shadow-lg" style={{ background: "white", borderRadius: 18 }}>
        <div className="flex flex-col items-center text-center gap-6">
          {/* Icon */}
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
            ¡Reserva confirmada
          </h1>

          <p className="max-w-xl text-sm md:text-base" style={{ color: "var(--color-text)" }}>
            Gracias por tu reserva en Rubikiai. Hemos recibido tu pago y tu reserva está confirmada.
            {reservationId ? " — ID: " : ""}
            <span className="font-mono ml-1" style={{ color: "var(--color-highlight)" }}>{reservationId ?? ""}</span>
          </p>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <Link href={`/reservations?reservationId=${encodeURIComponent(reservationId ?? "")}`} className="block">
              <button
                className="w-full py-3 rounded-lg font-semibold"
                style={{
                  background: "var(--color-primary)",
                  color: "white",
                  boxShadow: "0 6px 18px rgba(143,110,82,0.12)",
                }}
              >
                Ver mi reserva
              </button>
            </Link>

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
            <p style={{ color: "var(--color-text)" }}>
              ¿Necesitas ayuda? <a href="mailto:hello@rubikiai.example" style={{ color: "var(--color-primary-dark)", fontWeight: 600 }}>Contáctanos</a>
            </p>
          </div>

          <div className="mt-4 w-full text-center text-xs text-gray-400">
            <p>Recibirás un e-mail con los detalles. Guarda el ID de reserva para cualquier incidencia.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
