// app/reservations/page.tsx
"use client";

import React from "react";
import ReservationForm from "@/components/ReservationForm";
import { useRouter } from "next/navigation";
// IMPORTA el mapping centralizado que creaste en lib/houseRoutes.ts
import { HOUSE_ROUTE_OVERRIDES_BY_ID } from "@/lib/houseRoutes";

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

  const handleReserve = (houseId: string, startDate: Date, endDate: Date) => {
    // seguridad: validar fechas
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      router.push("/reservations");
      return;
    }

    // duo (composite id) -> ir directamente al checkout con houseId compuesto
    if (isDuoId(houseId)) {
      const q = `houseId=${encodeURIComponent(houseId)}&start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`;
      router.push(`/reservations/checkout?${q}`);
      return;
    }

    // buscar override por id en el mapping centralizado
    const override = HOUSE_ROUTE_OVERRIDES_BY_ID[houseId];
    if (override) {
      const q = `start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}${
        override.houseParam ? `&house=${encodeURIComponent(override.houseParam)}` : ""
      }`;
      router.push(`${override.path}?${q}`);
      return;
    }

    // fallback: si no hay override, ir al checkout por houseId
    {
      const q = `houseId=${encodeURIComponent(houseId)}&start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`;
      router.push(`/reservations/checkout?${q}`);
    }
  };

  return (
    <div className="p-6 bg-[var(--color-background-main)] min-h-screen">
      <ReservationForm onReserve={handleReserve} showResults={true} />
    </div>
  );
}
