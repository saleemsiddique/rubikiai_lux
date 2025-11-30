"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { FaUserFriends } from 'react-icons/fa';

interface AboutSectionProps {
  title?: string;
  description?: React.ReactNode;
  // Reservation props
  startFriendly?: string | null;
  endFriendly?: string | null;
  checkoutTime?: string;
  guestsDisplay?: string;
  typeParam?: string;
  loadingPrice?: boolean;
  priceError?: string | null;
  totalFromServer?: number | null;
  firstFromServer?: number | null;
  startParam?: string | null;
  endParam?: string | null;
  formatCurrency?: (n?: number | null) => string | null;
  onSelectDates?: () => void;
  onReserveNow?: () => void;
}

export default function AboutSection({
  title,
  description,
  startFriendly,
  endFriendly,
  checkoutTime = "11:00",
  guestsDisplay,
  typeParam,
  loadingPrice,
  priceError,
  totalFromServer,
  firstFromServer,
  startParam,
  endParam,
  formatCurrency,
  onSelectDates,
  onReserveNow,
}: AboutSectionProps) {
  const t = useTranslations('housePage');
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="pt-2 pb-8 px-4 md:py-4 bg-[#f4efe9] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#8f6e52]/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="container mx-auto max-w-7xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-22">
          {/* Left: About Content */}
          <div className="lg:col-span-1">
            <div
              className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                }`}
            >

              {/* Title with decorative line */}
              <div className="mb-3 md:mb-8 -mx-4 md:mx-0">
                <div className="flex items-center gap-4 md:gap-6 px-4 py-4 md:px-0 md:py-0 bg-[#1b343b] md:bg-transparent backdrop-blur-md border-l-4 md:border-l-0 border-[#bfa58b] shadow-xl md:shadow-none">
                  <div className="h-1 w-12 md:w-20 bg-gradient-to-r from-[#bfa58b] to-[#214235] flex-shrink-0 shadow-lg md:shadow-none md:hidden" />
                  <h2 className="text-xl md:text-4xl lg:text-5xl font-bold font-header text-[#f4efe9] md:text-[var(--color-secondary)] drop-shadow-lg md:drop-shadow-none">
                    <span className="md:hidden">{title}</span>
                    <span className="hidden md:inline">{t('aboutThisPlace')}</span>
                  </h2>
                </div>
              </div>

              {/* Description content */}
              <div
                className={`prose prose-lg max-w-none font-sans text-[#0f172a] leading-relaxed transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                style={{
                  lineHeight: '0.2'
                }}
              >
                {description ? (
                  <div className="prose prose-neutral prose-xl max-w-none [&_p]:text-lg [&_p]:mb-3 [&_p]:leading-relaxed">
                    {description}
                  </div>
                ) : (
                  <p className="text-neutral-700">
                    Add a custom description using the <code>description</code> prop.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Reservation Card - Desktop only */}
          <div className="hidden md:block lg:col-span-1">
            <div
              className={`sticky top-24 transition-all duration-1000 delay-600 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                }`}
            >
              <div className="relative bg-white rounded-2xl shadow-[0_10px_40px_rgba(27,52,59,0.15)] border-2 border-[#bfa58b]/30 overflow-hidden backdrop-blur-sm">
                {/* Decorative accent bar at top */}

                {/* Header */}
                <div className="bg-[#8f6e52] p-3 border-b-2 border-[#bfa58b]/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#bfa58b] to-[#8f6e52] flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold font-header text-white drop-shadow-lg">
                      {t('yourReservation')}
                    </h3>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5 bg-gradient-to-b from-white to-[#f4efe9]/30">
                  {/* Check-in/out times - Only show when NO dates selected */}
                  {!startParam && !endParam && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-4 bg-white rounded-xl border-2 border-[#bfa58b]/30 hover:border-[#bfa58b]/50 hover:shadow-md transition-all duration-300">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[#bfa58b] to-[#8f6e52] flex items-center justify-center shadow-sm">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-xs uppercase tracking-wider text-[#8f6e52]/70 mb-1">{t('checkIn')}</h4>
                          <p className="text-base font-semibold text-[#bfa58b]">16:00</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-4 bg-white rounded-xl border-2 border-[#bfa58b]/30 hover:border-[#bfa58b]/50 hover:shadow-md transition-all duration-300">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[#bfa58b] to-[#8f6e52] flex items-center justify-center shadow-sm">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-xs uppercase tracking-wider text-[#8f6e52]/70 mb-1">{t('checkOut')}</h4>
                          <p className="text-base font-semibold text-[#bfa58b]">{checkoutTime}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Summary */}
                  {startParam && endParam ? (
                    <div className="p-5 rounded-xl bg-white border-2 border-[#bfa58b]/30 space-y-4 shadow-sm">
                      <div className="flex items-center gap-2 pb-3 border-b border-[#bfa58b]/30">
                        <svg className="w-5 h-5 text-[#bfa58b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-xs font-bold text-[#8f6e52] uppercase tracking-wider">
                          {t('paymentSummary')}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-[#8f6e52]">
                          <FaUserFriends className="mr-2 text-[#bfa58b]" />
                          <span>{t('guests')}: <span className="font-semibold">{guestsDisplay}</span></span>
                        </div>
                        {typeParam && (
                          <div className="text-sm text-[#8f6e52]">
                            {t('type')}: <span className="font-semibold">{typeParam}</span>
                          </div>
                        )}
                      </div>

                      {loadingPrice ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-[#bfa58b] border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm text-[#8f6e52]">{t('calculatingPrice')}</span>
                        </div>
                      ) : priceError ? (
                        <div className="text-sm text-red-600 font-medium">{t('couldNotCalculatePrice')}</div>
                      ) : totalFromServer !== null ? (
                        <div className="space-y-3">
                          <div className="pb-3 border-b border-[#bfa58b]/30">
                            <div className="text-xs text-[#8f6e52]/70 uppercase tracking-wider mb-1">{t('totalForStay')}</div>
                            <div className="text-3xl font-bold text-[#8f6e52] tracking-tight">
                              {formatCurrency && formatCurrency(totalFromServer)}
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-[#8f6e52]/10 border-l-4 border-[#bfa58b]">
                            <div className="text-xs text-[#8f6e52]/70 font-semibold uppercase tracking-wider mb-1">{t('chargeNow')}</div>
                            {firstFromServer !== null ? (
                              <div className="text-2xl font-bold text-[#8f6e52]">
                                {formatCurrency && formatCurrency(firstFromServer)}
                              </div>
                            ) : (
                              <div className="text-sm font-semibold text-[#8f6e52]">
                                {t('reservationFeeShown')}
                              </div>
                            )}
                            <div className="mt-2 text-xs text-[#8f6e52]/70">
                              {t('remainingAmountOnArrival')}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-[#8f6e52]">{t('selectDatesToSeePrice')}</div>
                      )}
                    </div>
                  ) : null}

                  {/* Action Button */}
                  {startParam && endParam ? (
                    <button
                      onClick={onReserveNow}
                      className="relative overflow-hidden group w-full bg-[#8f6e52] text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 border-2 border-[#bfa58b]/30 hover:border-[#bfa58b]/50"
                    >
                      {/* Shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#bfa58b]/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />

                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {t('reserveNow')}
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={onSelectDates}
                      className="relative overflow-hidden group w-full bg-[#8f6e52] text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 border-2 border-[#bfa58b]/30 hover:border-[#bfa58b]/50"
                    >
                      {/* Shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#bfa58b]/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />

                      <span className="relative z-10">{t('selectDates')}</span>
                    </button>
                  )}
                </div>

                {/* Subtle bottom accent */}
                <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/20 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}