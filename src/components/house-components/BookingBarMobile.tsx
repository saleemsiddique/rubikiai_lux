"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CreditCard } from 'lucide-react';

interface BookingBarMobileProps {
  showHeroButton: boolean;
  loadingPrice: boolean;
  priceError: string | null;
  totalFromServer: number | null;
  firstFromServer: number | null;
  startParam: string | null;
  endParam: string | null;
  handleReserveNow: () => void;
  formatCurrency: (n?: number | null) => string | null;
}

export default function BookingBarMobile({
  showHeroButton,
  loadingPrice,
  priceError,
  totalFromServer,
  firstFromServer,
  startParam,
  endParam,
  handleReserveNow,
  formatCurrency,
}: BookingBarMobileProps) {
  const router = useRouter();

  const showPrice = totalFromServer !== null || firstFromServer !== null;

  return (
    <div className="md:hidden fixed left-3 right-3 bottom-4 z-50">
      <div className="relative bg-gradient-to-br from-white via-[#f4efe9]/30 to-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[var(--color-primary)]/20 backdrop-blur-md overflow-hidden">
        {/* Decorative accent bar at top */}
        <div className="h-1 bg-gradient-to-r from-[var(--color-secondary)] via-[var(--color-primary)] to-[var(--color-secondary)]" />
        
        <div className="p-4 flex items-center justify-between gap-4">
          {/* Price Section */}
          <div className="flex-1 min-w-0">
            {loadingPrice ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600 font-medium">Calculating...</span>
              </div>
            ) : priceError ? (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600 font-medium">Price unavailable</span>
              </div>
            ) : showPrice ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-secondary)]/70 font-semibold">
                  <CreditCard className="w-3 h-3" />
                  <span>Total / Charge now</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-xl font-bold text-[var(--color-secondary)] tracking-tight">
                    {formatCurrency(totalFromServer ?? undefined)}
                  </div>
                  {firstFromServer !== null && (
                    <div className="text-sm text-gray-500 font-medium">
                      / {formatCurrency(firstFromServer ?? undefined)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
                <span className="text-sm text-gray-700 font-medium">Select dates to see price</span>
              </div>
            )}
          </div>

          {/* CTA Button */}
          <button
            onClick={() => {
              if (!startParam || !endParam) {
                router.push("/reservations");
                return;
              }
              handleReserveNow();
            }}
            className="relative overflow-hidden group whitespace-nowrap px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 bg-gradient-to-r from-[var(--color-secondary)] via-[var(--color-primary-dark)] to-[var(--color-secondary)] text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
            
            <span className="relative z-10 flex items-center gap-2">
              {startParam && endParam ? (
                <>
                  Reserve now
                  <span className="text-xs">→</span>
                </>
              ) : (
                <>
                  Select dates
                  <Calendar className="w-3.5 h-3.5" />
                </>
              )}
            </span>
          </button>
        </div>

        {/* Subtle bottom accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/20 to-transparent" />
      </div>
    </div>
  );
}