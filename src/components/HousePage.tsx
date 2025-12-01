"use client";

import React, { useEffect, useMemo, useState, useRef, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from 'next-intl';
import ImageGallery from "@/components/ImageGallery";
import OtherOptions from "@/components/OtherOptions";
import BookingBarMobile from "@/components/house-components/BookingBarMobile";
import AboutSection from "@/components/house-components/AboutSectionHouse";
import AmenitiesSection from "@/components/house-components/AmenitiesSection";
import { HOUSE_ROUTE_OVERRIDES_BY_ID } from "@/lib/houseRoutes";

type AmenitiesSectionType = {
  title: string;
  items: string[];
};

export type HousePageProps = {
  heroSrc: string;
  heroAlt?: string;
  title: string;
  subtitle?: string;
  accommodates?: number | string;
  size?: string;
  beds?: string;
  images: string[];
  houseSlug: string;
  defaultGuests?: string;
  defaultType?: string;
  description?: React.ReactNode;
  amenitiesSections?: AmenitiesSectionType[];
  mapSrc?: string;
};

const formatDateFriendly = (iso?: string | null) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
};

const formatCurrency = (n?: number | null) => {
  if (n == null || Number.isNaN(n)) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

const isIsoDateString = (s: string | null) => {
  if (!s) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
};

// Componente interno que usa useSearchParams
function HousePageContent(props: HousePageProps) {
  const {
    heroSrc,
    heroAlt,
    title,
    subtitle,
    accommodates,
    size,
    beds,
    images,
    houseSlug,
    defaultGuests = "2",
    defaultType = "",
    amenitiesSections = [],
    mapSrc,
    description,
  } = props;

  const t = useTranslations('housePage');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [scrollY, setScrollY] = useState(0);
  const [heroHeight, setHeroHeight] = useState(0);

  const lastYRef = useRef(0);
  const tickingRef = useRef(false);

  const scrolled = scrollY > 50;

  const [isMobile, setIsMobile] = useState<boolean>(false);

  const startParam = searchParams?.get("start") ?? null;
  const endParam = searchParams?.get("end") ?? null;
  const guestsParam = searchParams?.get("guests") ?? defaultGuests;
  const typeParam = searchParams?.get("type") ?? defaultType;

  const hasQueryParams = Boolean(
    searchParams?.has("start") ||
    searchParams?.has("end") ||
    searchParams?.has("guests") ||
    searchParams?.has("type")
  );

  const startFriendly = formatDateFriendly(startParam);
  const endFriendly = formatDateFriendly(endParam);

  const houseIdFromMapping = useMemo(() => {
    try {
      const entries = Object.entries(HOUSE_ROUTE_OVERRIDES_BY_ID || {});
      const found = entries.find(([, v]) => v && v.houseParam === houseSlug);
      return found ? found[0] : undefined;
    } catch {
      return undefined;
    }
  }, [houseSlug]);

  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [totalFromServer, setTotalFromServer] = useState<number | null>(null);
  const [firstFromServer, setFirstFromServer] = useState<number | null>(null);

  async function callPriceEndpoint(endpoint: string, body: any) {
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  useEffect(() => {
    if (!houseIdFromMapping) {
      setPriceError(t('houseMappingNotFound'));
      setTotalFromServer(null);
      setFirstFromServer(null);
      return;
    }

    if (!isIsoDateString(startParam) || !isIsoDateString(endParam)) {
      setTotalFromServer(null);
      setFirstFromServer(null);
      setPriceError(null);
      return;
    }

    let mounted = true;

    const doFetch = async () => {
      setLoadingPrice(true);
      setPriceError(null);
      setTotalFromServer(null);
      setFirstFromServer(null);

      const body = {
        houseId: houseIdFromMapping,
        startDate: startParam,
        endDate: endParam,
        guests: parseInt(guestsParam || String(defaultGuests), 10),
        type: typeParam,
      };

      const endpoints = [`/${locale}/api/reservations/price`, `/${locale}/api/reservation/price`];
      let lastErr: string | null = null;

      for (const ep of endpoints) {
        try {
          const res = await callPriceEndpoint(ep, body);
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            lastErr = `Endpoint ${ep} returned ${res.status}: ${text.substring(0, 300)}`;
            if (res.status === 404) continue;
            throw new Error(lastErr);
          }

          const data = await res.json().catch((e) => {
            throw new Error(`Invalid JSON from ${ep}: ${String(e)}`);
          });

          const total = typeof data.total === "number" ? data.total : null;
          const first = typeof data.first === "number" ? data.first : null;

          if (mounted) {
            setTotalFromServer(total);
            setFirstFromServer(first);
            setPriceError(null);
            setLoadingPrice(false);
          }
          return;
        } catch (err: any) {
          lastErr = err?.message ?? String(err);
        }
      }

      if (mounted) {
        setPriceError(lastErr ?? t('couldNotFetchPrice'));
        setTotalFromServer(null);
        setFirstFromServer(null);
        setLoadingPrice(false);
      }
    };

    doFetch();

    return () => {
      mounted = false;
    };
  }, [startParam, endParam, guestsParam, typeParam, houseIdFromMapping, defaultGuests, t, locale]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const heroEl = document.getElementById("hero-section");

    const updateHeroHeight = () => {
      const h = heroEl ? heroEl.getBoundingClientRect().height : window.innerHeight * 0.75;
      setHeroHeight(h);
    };

    updateHeroHeight();
    setScrollY(window.scrollY);
    const mq = window.matchMedia("(min-width: 768px)");
    const mobileHandler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(!e.matches);
    setIsMobile(!mq.matches);

    const onResize = () => updateHeroHeight();

    const onScroll = () => {
      lastYRef.current = window.scrollY;
      if (!tickingRef.current) {
        tickingRef.current = true;
        requestAnimationFrame(() => {
          setScrollY(lastYRef.current);
          tickingRef.current = false;
        });
      }
    };

    if (typeof mq.addEventListener === "function") mq.addEventListener("change", mobileHandler);
    else mq.addListener(mobileHandler);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", mobileHandler);
      else mq.removeListener(mobileHandler);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const guestsDisplay = (() => {
    const p = parseInt(guestsParam as string, 10);
    if (!Number.isFinite(p) || Number.isNaN(p)) return defaultGuests;
    return String(p);
  })();

  const checkoutTime = title?.includes("EŽERO NAMELIS") ? "12:00" : "11:00";

  const handleReserveNow = () => {
    if (!startParam || !endParam) {
      router.push("/reservations");
      return;
    }

    if (!houseIdFromMapping) {
      alert(t('couldNotIdentifyAccommodation'));
      return;
    }

    const q = new URLSearchParams({
      houseId: houseIdFromMapping,
      houseSlug: houseSlug || "",
      houseTitle: title || "",
      start: startParam,
      end: endParam,
      guests: String(parseInt(guestsParam || defaultGuests, 10)),
    });

    router.push(`/checkout-details?${q.toString()}`);
  };

  const showHeroButton = scrollY < heroHeight - 100;
  const showFloating = isMobile && scrolled;

  return (
    <main className="text-[var(--color-text)] md:pb-0 overflow-x-hidden max-w-full">
      {/* Hero Section */}
      <section id="hero-section" className="relative">
        <div className="relative h-[75vh] md:h-screen w-full overflow-hidden">
          <Image
            src={heroSrc}
            alt={heroAlt ?? title}
            fill
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority
            className="absolute inset-0"
          />

          <div className="absolute bottom-0 left-0 right-0 p-6 md:pb-12 md:px-8 lg:pb-16 lg:px-12 xl:px-16">
            <div className="w-full max-w-[1600px] mx-auto">
              <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 md:gap-8">
                <div className="text-white md:max-w-lg lg:max-w-2xl">
                  <h1
                    className="text-2xl md:text-4xl lg:text-5xl font-bold font-header mb-2 md:mb-3 leading-tight tracking-tight hidden md:block"
                    style={{
                      animation: 'fadeInUp 0.8s ease-out',
                      textShadow: '0 2px 20px rgba(0,0,0,0.4)'
                    }}
                  >
                    {title}
                  </h1>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {hasQueryParams ? (
        <BookingBarMobile
          showHeroButton={showHeroButton}
          loadingPrice={loadingPrice}
          priceError={priceError}
          totalFromServer={totalFromServer}
          firstFromServer={firstFromServer}
          startParam={startParam}
          endParam={endParam}
          handleReserveNow={handleReserveNow}
          formatCurrency={formatCurrency}
        />
      ) : (
        <button
          onClick={() => router.push(`/${locale}/reservations`)}
          className={`md:hidden fixed bottom-6 right-6 z-40 bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary-dark)] text-white px-6 py-3 rounded-full shadow-2xl transition-all duration-500 flex items-center gap-2 font-semibold text-sm ${scrolled
            ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
            : 'opacity-0 translate-y-4 pointer-events-none scale-95'
            }`}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'opacity, transform'
          }}
          aria-hidden={!showFloating}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>            
            {t('reserveNow')}
          </span>
        </button>
      )}

      <AboutSection
        title={title}
        description={description}
        startFriendly={startFriendly}
        endFriendly={endFriendly}
        checkoutTime={checkoutTime}
        guestsDisplay={guestsDisplay}
        typeParam={typeParam}
        loadingPrice={loadingPrice}
        priceError={priceError}
        totalFromServer={totalFromServer}
        firstFromServer={firstFromServer}
        startParam={startParam}
        endParam={endParam}
        formatCurrency={formatCurrency}
        onSelectDates={() => router.push("/reservations")}
        onReserveNow={handleReserveNow}
      />

      <AmenitiesSection amenitiesSections={amenitiesSections} />

      <ImageGallery images={images} />

      <section className="py-8 px-4 md:py-20 bg-[#1b343b] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#bfa58b]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#8f6e52]/5 rounded-full blur-3xl" />

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 50px),
                       repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 50px)`
          }}
        />

        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-4">
            <div className="inline-block">
              <div className="h-1 w-20 bg-[#bfa58b] mx-auto mb-4" />
              <h2 className="text-3xl md:text-5xl font-bold font-header text-[#f4efe9]">
                {t('location')}
              </h2>
            </div>
            <p className="text-[#f4efe9]/80 text-lg mt-4 max-w-2xl mx-auto">
              {t('findOnMaps')}
            </p>
          </div>
          <div className="relative w-full h-96 md:h-[500px] rounded-2xl overflow-hidden shadow-2xl border-2 border-[#bfa58b]/30">
            <iframe
              src={
                mapSrc ??
                `https://www.google.com/maps?q=Rubikiai%20LUX%20SPA%20Apartments%2C%20Piliakalnio%20vs%201%2C%20Anykščiai%2029203%2C%20Lituania&hl=${locale}&z=15&output=embed`
              }
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              aria-label="Location map"
            />
          </div>
        </div>
      </section>

      <OtherOptions />

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}

// Componente principal exportado con Suspense
export default function HousePage(props: HousePageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-bg)]">
        <div className="relative h-[75vh] md:h-screen w-full bg-gray-200 animate-pulse" />
      </div>
    }>
      <HousePageContent {...props} />
    </Suspense>
  );
}