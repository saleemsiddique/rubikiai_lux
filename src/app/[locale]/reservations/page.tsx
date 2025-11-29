// app/reservations/page.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
// IMPORTA el mapping centralizado que creaste en lib/houseRoutes.ts
import { HOUSE_ROUTE_OVERRIDES_BY_ID } from "@/lib/houseRoutes";
// IMPORTA el helper que convierte a YYYY-MM-DD local
import { toLocalDateString } from "@/app/[locale]/utils/date";
import { FaInfoCircle, FaShieldAlt } from "react-icons/fa";
import dynamic from "next/dynamic";

const ReservationForm = dynamic(() => import("@/components/ReservationForm"), { ssr: false });

/**
 * ReservationPage
 *
 * Nota:
 * - Mappings (HOUSE_ROUTE_OVERRIDES_BY_ID) deben vivir en lib/houseRoutes.ts (ya lo tienes).
 * - El precio definitivo debe solicitarse al endpoint server-side (/api/reservations/price)
 *   desde la página del alojamiento o desde el checkout; nunca confiar en valores pasados en la URL.
 */

export default function ReservationPage() {
  const router = useRouter();

  const isDuoId = (id?: string) => !!id && id.includes("__");

  const isValidDate = (d: unknown): d is Date => {
    return d instanceof Date && !Number.isNaN(d.getTime());
  };

  const handleReserve = (houseId: string, startDate: Date, endDate: Date, guests: number) => {
    // seguridad: validar fechas
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      router.push("/reservations");
      return;
    }

    // normaliza a YYYY-MM-DD (fecha local)
    let startLocal: string;
    let endLocal: string;
    try {
      startLocal = toLocalDateString(startDate);
      endLocal = toLocalDateString(endDate);
    } catch (e) {
      console.error("Invalid date normalization", e);
      router.push("/reservations");
      return;
    }

    // seguridad: formato coherente (start < end)
    if (new Date(endLocal).getTime() <= new Date(startLocal).getTime()) {
      console.error("Invalid date range");
      router.push("/reservations");
      return;
    }

    // duo (composite id) -> ir directamente al checkout con houseId compuesto
    if (isDuoId(houseId)) {
      const q = `houseId=${encodeURIComponent(houseId)}&start=${encodeURIComponent(startLocal)}&end=${encodeURIComponent(
        endLocal
      )}&guests=${encodeURIComponent(String(guests))}`;
      router.push(`/reservations/checkout?${q}`);
      return;
    }

    // buscar override por id en el mapping centralizado
    const override = HOUSE_ROUTE_OVERRIDES_BY_ID[houseId];
    if (override) {
      const q = `houseId=${encodeURIComponent(houseId)}&start=${encodeURIComponent(startLocal)}&end=${encodeURIComponent(
        endLocal
      )}&guests=${encodeURIComponent(String(guests))}`;
      router.push(`${override.path}?${q}`);
      return;
    }

    // fallback: si no hay override, ir al checkout por houseId
    {
      const q = `houseId=${encodeURIComponent(houseId)}&start=${encodeURIComponent(startLocal)}&end=${encodeURIComponent(
        endLocal
      )}&guests=${encodeURIComponent(String(guests))}`;
      router.push(`/reservations/checkout?${q}`);
    }
  };

  return (
    <div className="p-6 bg-[var(--color-background-main)] min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <ReservationForm onReserve={handleReserve} showResults={true} />

        {/* --- House Rules & Terms (debajo del form) --- */}
        <section aria-labelledby="rules-title" className="mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* House Rules */}
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <FaShieldAlt className="text-[var(--color-primary)]" />
                <h2
                  id="rules-title"
                  className="text-lg font-semibold text-[var(--color-primary-dark)]"
                >
                  House rules
                </h2>
              </div>

              <ul className="mt-2 space-y-2 text-sm text-neutral-700">
                <li>• Apartments are rented for quiet relaxation only.</li>

                <li>
                  • Minors are accepted only from <strong>16 years of age</strong>, or by prior
                  arrangement when booking <strong>both duplex apartments</strong>.
                </li>

                <li>
                  • For the safety and peace of the fallow deer —{" "}
                  <strong className="uppercase tracking-wide">
                    bringing pets to the duplex is strictly prohibited
                  </strong>
                  .
                </li>

                <li>
                  • By making a reservation, you confirm that you have read our{" "}
                  <strong>house rules</strong> and <strong>reservation terms</strong>.
                </li>

                <li>
                  • <strong>Check-in</strong> time is from <strong>16:00</strong>. <strong>Check-out</strong> time is until <strong>12:00</strong> in Ezero Namelis and <strong>11:00</strong> in Duplexes.
                </li>
              </ul>

              <p className="mt-4 text-sm text-neutral-600">
                You can view all rules on our{" "}
                <a
                  href="/house-rules"
                  className="font-semibold text-[var(--color-primary)] hover:underline"
                >
                  House Rules
                </a>{" "}
                page.
              </p>
            </div>


            {/* Payment & Terms */}
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <FaInfoCircle className="text-[var(--color-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--color-primary-dark)]">Payment & booking terms</h2>
              </div>
              <div className="mt-2 space-y-3 text-sm text-neutral-700">
                <p>
                  When reserving, you pay a booking deposit equal to <strong>one night’s stay</strong>. The remaining amount is paid upon
                  arrival.
                </p>
                <p className="text-neutral-700">
                  If an error occurs in the booking system that makes the service unavailable or results in an unreasonably low price,{" "}
                  we will inform you as soon as possible and the reservation will be{" "}
                  <strong>canceled</strong>, <strong>rescheduled</strong>, or your <strong>deposit will be refunded</strong>.
                </p>
                <p>
                  You may change the reservation date once free of charge no later than 7 days before arrival. The reservation deposit is
                  non-refundable. Multiple date changes cost €20.
                </p>
              </div>
            </div>
          </div>
        </section>
        {/* --- /House Rules & Terms --- */}
      </div>
    </div>
  );
}
