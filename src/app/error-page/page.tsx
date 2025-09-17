"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaExclamationTriangle, FaCalendarAlt, FaUser } from "react-icons/fa";

export default function GenericErrorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // You can pass any parameters you want to display
  const message = searchParams?.get("message") ?? "An error occurred.";
  const details = searchParams?.get("details") ?? null;

  const handleBack = () => {
    router.push("/reservations");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-full bg-yellow-100 text-yellow-700">
            <FaExclamationTriangle size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{message}</h1>
            {details && <p className="text-sm text-gray-600">{details}</p>}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleBack}
            className="flex-1 py-3 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold transition"
          >
            Back to search
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500">If you believe this is an error, contact support.</div>
      </div>
    </main>
  );
}
