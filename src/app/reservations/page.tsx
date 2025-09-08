"use client";
import React from "react";
import ReservationForm from "@/components/ReservationForm";
import { useRouter } from "next/navigation";

export default function ReservationPage() {
  const router = useRouter();

  const handleReserve = (houseId: string, startDate: Date, endDate: Date) => {
    router.push(`/reservations/checkout?houseId=${houseId}&start=${startDate.toISOString()}&end=${endDate.toISOString()}`);
  };

  return (
    <div className="p-6 bg-[var(--color-background-main)] min-h-screen">
      <ReservationForm onReserve={handleReserve} showResults={true}/>
    </div>
  );
}
