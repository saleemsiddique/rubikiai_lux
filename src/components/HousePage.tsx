"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import ImageGallery from "@/components/ImageGallery";
import OtherOptions from "@/components/OtherOptions";
import BookingBarMobile from "@/components/house-components/BookingBarMobile";
import AboutSection from "@/components/house-components/AboutSectionHouse";
import AmenitiesSection from "@/components/house-components/AmenitiesSection";
import { FaBed, FaUserFriends, FaRulerCombined } from "react-icons/fa";
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

export default function HousePage(props: HousePageProps) {
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

  const router = useRouter();
  const searchParams = useSearchParams();

  const [scrollY, setScrollY] = useState(0);
  const [heroHeight, setHeroHeight] = useState(0);
  const [isStatsVisible, setIsStatsVisible] = useState(false);

  const startParam = searchParams?.get("start") ?? null;
  const endParam = searchParams?.get("end") ?? null;
  const guestsParam = searchParams?.get("guests") ?? defaultGuests;
  const typeParam = searchParams?.get("type") ?? defaultType;

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
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    const updateHeroHeight = () => {
      const hero = document.getElementById('hero-section');
      if (hero) {
        setHeroHeight(hero.offsetHeight);
      }
    };

    handleScroll();
    updateHeroHeight();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateHeroHeight);

    setTimeout(() => setIsStatsVisible(true), 300);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateHeroHeight);
    };
  }, []);

  useEffect(() => {
    if (!houseIdFromMapping) {
      setPriceError("House mapping not found.");
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

      const endpoints = ["/api/reservations/price", "/api/reservation/price"];
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
        setPriceError(lastErr ?? "Could not fetch price");
        setTotalFromServer(null);
        setFirstFromServer(null);
        setLoadingPrice(false);
      }
    };

    doFetch();

    return () => {
      mounted = false;
    };
  }, [startParam, endParam, guestsParam, typeParam, houseIdFromMapping, defaultGuests]);

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
      alert("Could not identify the accommodation. Please try again.");
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

  return (
    <main className="text-[var(--color-text)] md:pb-0">
      {/* Hero Section */}
      <section id="hero-section" className="relative">
        {/* Hero Image */}
        <div className="relative h-[75vh] md:h-screen w-full overflow-hidden">
          <Image
            src={heroSrc}
            alt={heroAlt ?? title}
            fill
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority
            className="absolute inset-0"
          />

          {/* Mobile Gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/70 md:hidden" />

          {/* Desktop Gradient - Darker at bottom */}
          <div className="hidden md:block absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/80" />

          {/* Content Container - Bottom aligned, full width */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:pb-12 md:px-8 lg:pb-16 lg:px-12 xl:px-16">
            <div className="w-full max-w-[1600px] mx-auto">
              <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 md:gap-8">
                {/* Left: Title and Subtitle */}
                <div className="text-white md:max-w-lg lg:max-w-2xl">
                  <h1
                    className="text-4xl md:text-4xl lg:text-5xl font-bold font-header mb-2 md:mb-3 leading-tight tracking-tight"
                    style={{
                      animation: 'fadeInUp 0.8s ease-out',
                      textShadow: '0 2px 20px rgba(0,0,0,0.4)'
                    }}
                  >
                    {title}
                  </h1>
                  {subtitle && (
                    <p
                      className="text-lg md:text-base lg:text-lg font-light font-sans opacity-90 leading-relaxed"
                      style={{
                        animation: 'fadeInUp 0.8s ease-out 0.2s both',
                        textShadow: '0 1px 10px rgba(0,0,0,0.4)'
                      }}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      <AboutSection
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
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#bfa58b]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#8f6e52]/5 rounded-full blur-3xl" />

        {/* Subtle grid pattern overlay */}
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
                Location
              </h2>
            </div>
            <p className="text-[#f4efe9]/80 text-lg mt-4 max-w-2xl mx-auto">
              Find us on Google Maps to plan your trip
            </p>
          </div>
          <div className="relative w-full h-96 md:h-[500px] rounded-2xl overflow-hidden shadow-2xl border-2 border-[#bfa58b]/30">
            <iframe
              src={
                mapSrc ??
                "https://www.google.com/maps?q=Rubikiai%20LUX%20SPA%20Apartments%2C%20Piliakalnio%20vs%201%2C%20Anykščiai%2029203%2C%20Lituania&hl=lt&z=15&output=embed"
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