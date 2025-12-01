"use client";

import React, { useEffect, useRef, useCallback, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from 'next-intl';

// Componente interno que usa useSearchParams
function HeaderContent() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('nav');
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const langRef = useRef<HTMLDivElement | null>(null);

  // Refs for rAF scroll handling + hysteresis
  const lastYRef = useRef<number>(0);
  const tickingRef = useRef<boolean>(false);
  const scrolledRef = useRef<boolean>(false);

  const SCROLL_DOWN_THRESHOLD = 60;
  const SCROLL_UP_THRESHOLD = 40;

  const pageTitles: Record<string, string> = {
    [`/${locale}`]: t('inicio'),
    [`/${locale}/dupleksas`]: t('dupleksas'),
    [`/${locale}/ezero-namelis`]: t('ezeroNamelis'),
    [`/${locale}/reservations`]: t('reservations').toUpperCase(),
    [`/${locale}/coupons`]: t('coupons').toUpperCase(),
    [`/${locale}/faq`]: t('faq').toUpperCase(),
    [`/${locale}/contact`]: t('contact').toUpperCase(),
  };

  const navLinks = [
    { name: t('home'), href: `/${locale}` },
    { name: t('dupleksas'), href: `/${locale}/dupleksas` },
    { name: 'Ežero Namelis', href: `/${locale}/ezero-namelis` },
    { name: t('reservations'), href: `/${locale}/reservations` },
    { name: t('coupons'), href: `/${locale}/coupons` },
    { name: t('faq'), href: `/${locale}/faq` },
    { name: t('contact'), href: `/${locale}/contact` },
  ];

  const languages = [
    { code: 'lt', label: 'LT' },
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RUS' },
  ];

  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggleLang = useCallback(() => setIsLangOpen((v) => !v), []);
  const closeLang = useCallback(() => setIsLangOpen(false), []);

  // Check if we're on home page
  const isHomePage = pathname === `/${locale}`;
  const isHousePage =
    pathname.startsWith(`/${locale}/dupleksas/`) ||
    pathname === `/${locale}/dupleksas` ||
    pathname === `/${locale}/ezero-namelis`;

  // Devuelve el path actual SIN el prefijo de locale
  const getPathWithoutLocale = (loc: string) => {
    return pathname.replace(new RegExp(`^/${loc}`), '') || '/';
  };

  // Cambia el idioma preservando query string y hash
  const switchLanguage = (newLocale: string) => {
    const pathWithoutLocale = getPathWithoutLocale(locale);
    const rawSearch = searchParams?.toString() ?? '';
    const search = rawSearch ? `?${rawSearch}` : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const newPath = pathWithoutLocale === '/' ? `/${newLocale}` : `/${newLocale}${pathWithoutLocale}`;
    
    closeLang();
    router.push(newPath + search + hash);
  };

  // Smooth rAF-based scroll handling with hysteresis
  useEffect(() => {
    function onScroll() {
      lastYRef.current = window.scrollY;
      if (!tickingRef.current) {
        tickingRef.current = true;
        requestAnimationFrame(() => {
          const y = lastYRef.current;
          const prev = scrolledRef.current;
          let next = prev;

          if (!prev && y > SCROLL_DOWN_THRESHOLD) next = true;
          else if (prev && y < SCROLL_UP_THRESHOLD) next = false;

          if (next !== prev) {
            scrolledRef.current = next;
            setScrolled(next);
          }
          tickingRef.current = false;
        });
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    lastYRef.current = window.scrollY;
    if (window.scrollY > SCROLL_DOWN_THRESHOLD) {
      scrolledRef.current = true;
      setScrolled(true);
    }

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close drawer on navigation changes
  useEffect(() => {
    close();
    closeLang();
  }, [pathname, close, closeLang]);

  // lock body overflow when drawer open
  useEffect(() => {
    if (isOpen) document.body.classList.add("overflow-hidden");
    else document.body.classList.remove("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, [isOpen]);

  // detecta si estamos en pantallas "desktop"
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  // Close menu/lang on Escape and outside click
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        closeLang();
      }
    }
    function onClick(e: MouseEvent) {
      if (drawerRef.current && isOpen && !drawerRef.current.contains(e.target as Node)) {
        close();
      }
      if (langRef.current && isLangOpen && !langRef.current.contains(e.target as Node)) {
        closeLang();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [isOpen, isLangOpen, close, closeLang]);

  const hasQueryParamsHousePage = Boolean(
    searchParams?.has("start") ||
    searchParams?.has("end") ||
    searchParams?.has("guests") ||
    searchParams?.has("type")
  );

  const showMobileReservationButton =
    (isHomePage && (isDesktop || !scrolled)) ||
    (isHousePage && (isDesktop || !scrolled) && !hasQueryParamsHousePage);

  const currentLang = languages.find(l => l.code === locale) || languages[0];

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-400 ease-in-out`}
        style={{
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
          willChange: "background-color, box-shadow, backdrop-filter, opacity",
        }}
      >
        <div
          className={`max-w-screen-xl mx-auto px-4 sm:px-6 md:px-6 py-3 md:py-1 flex items-center justify-between transition-all duration-400`}
        >
          <div className="flex items-center gap-2 md:gap-2 min-w-[120px] md:min-w-[80px]">
            <button
              aria-expanded={isOpen}
              aria-label={isOpen ? t('closeNavigation') : t('openNavigation')}
              onClick={toggle}
              className={`p-2.5 md:p-2 rounded focus:outline-none focus:ring-2 hover:scale-105 transition-all duration-300 flex items-center justify-center flex-shrink-0 min-w-[40px] min-h-[40px]`}
              style={{ willChange: "transform, opacity" }}
            >
              <svg
                className={`w-7 h-7 md:w-6 md:h-6 transition-colors duration-300 ${scrolled ? "text-[var(--color-secondary)]" : "text-white md:text-[var(--color-secondary)]"
                  }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  className={`transition-all duration-200 ${isOpen ? "opacity-0 scale-90" : "opacity-100 scale-100"}`}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
                <g className={`transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0"}`}>
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </g>
              </svg>
            </button>

            <span
              className={`hidden sm:inline-block text-[10px] md:text-[16px] font-bold tracking-wide transition-colors duration-300 ${scrolled ? "text-[var(--color-secondary)]" : "text-white/90 md:text-[var(--color-secondary)] drop-shadow-lg"
                }`}
            >
              {pageTitles[pathname] || ""}
            </span>
          </div>

          <div className="flex-1 flex justify-center items-center pointer-events-none p-1">
            <Link href={`/${locale}`} className="block pointer-events-auto">
              <div
                className={`transform transition-all duration-400 will-change-transform will-change-opacity ${scrolled ? "opacity-100 scale-100" : "opacity-0 scale-95"
                  }`}
                style={{
                  transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <Image
                  src="/rubikiai-logo (1).png"
                  alt="Rubikiai Lux Logo"
                  width={120}
                  height={40}
                  priority
                  className="h-auto drop-shadow-2xl w-22 md:w-28 ml-0 md:ml-[109px]"
                  style={{ transition: "all 400ms cubic-bezier(0.4,0,0.2,1)" }}
                />
              </div>
            </Link>
          </div>

          {/* RIGHT SECTION - Book Button + Language Selector */}
          <div className="flex items-center gap-2 md:gap-3 min-w-[120px] md:min-w-[140px] justify-end">
            {/* Book Button */}
            <button
              onClick={() => showMobileReservationButton && (window.location.href = `/${locale}/reservations`)}
              disabled={!showMobileReservationButton}
              className={`uppercase tracking-wider text-[10px] md:text-[14px] px-4 py-2 md:px-5 md:py-2.5 rounded font-semibold transition-all duration-300 ease-in-out items-center justify-center min-w-[84px] md:min-w-[100px] ${!showMobileReservationButton ? "cursor-default hidden md:flex" : "cursor-pointer flex"
                }`}
            >
              <span
                className={`transition-all duration-300 rounded px-4 py-1 ${scrolled
                  ? "border-2 border-[var(--color-secondary)] text-[var(--color-secondary)] hover:bg-[var(--color-secondary)] hover:text-white"
                  : "border-2 border-white/80 md:border-[var(--color-secondary)] text-white md:text-[var(--color-secondary)] hover:bg-white md:hover:bg-[var(--color-secondary)] hover:text-[var(--color-secondary)] md:hover:text-white backdrop-blur-sm"
                  }`}
              >
                {t('reserve')}
              </span>
            </button>

            {/* Language Selector */}
            <div ref={langRef} className="relative flex-shrink-0">
              <button
                onClick={toggleLang}
                className={`flex items-center gap-1 px-2 py-1.5 md:px-2.5 md:py-2 rounded transition-all duration-300 ${
                  scrolled
                    ? "text-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/10"
                    : "text-white md:text-[var(--color-secondary)] hover:bg-white/10 md:hover:bg-[var(--color-secondary)]/10"
                }`}
                aria-expanded={isLangOpen}
                aria-label="Select language"
              >
                <span className="text-xs md:text-sm font-semibold">{currentLang.label}</span>
                <svg
                  className={`w-3 h-3 md:w-4 md:h-4 transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {isLangOpen && (
                <div className="absolute right-0 mt-2 py-1 bg-[var(--color-background-main)] rounded shadow-lg border border-[var(--color-secondary)]/20 min-w-[80px] z-50">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => switchLanguage(lang.code)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        lang.code === locale
                          ? 'bg-[var(--color-secondary)]/10 text-[var(--color-primary-dark)] font-semibold'
                          : 'text-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/5'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className={`absolute inset-0 pointer-events-none transition-all duration-400 ${scrolled
            ? "bg-[var(--color-background-main)]/97 backdrop-blur-md shadow-lg"
            : "bg-gradient-to-b from-black/50 to-transparent md:bg-[var(--color-background-main)]/20 md:backdrop-blur-sm"
            }`}
          style={{ zIndex: -1 }}
        />
      </header>

      {/* BACKDROP */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 transition-opacity" aria-hidden />
      )}

      {/* DRAWER */}
      <aside
        ref={drawerRef}
        className={`fixed top-0 left-0 z-[9999999] h-full w-[85vw] sm:w-3/4 md:w-1/2 lg:w-1/3 max-w-sm bg-[var(--color-background-main)] shadow-2xl transform transition-transform duration-300 ease-in-out overflow-y-auto ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        aria-hidden={!isOpen}
      >
        <div className="relative p-6 md:p-10 min-h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div />
            <button
              onClick={close}
              aria-label={t('closeMenu')}
              className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] hover:scale-105 transition-transform"
            >
              <svg className="w-6 h-6 text-[var(--color-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 flex flex-col justify-center items-center gap-4 px-4">
            {navLinks.map((n, idx) => (
              <React.Fragment key={n.href}>
                <Link
                  href={n.href}
                  onClick={close}
                  className={`w-full text-center font-sans text-[var(--color-secondary)] text-lg md:text-xl font-light hover:text-[var(--color-primary-dark)] transition-colors duration-200 uppercase py-2 ${pathname === n.href ? "text-[var(--color-primary-dark)] font-medium" : ""
                    }`}
                >
                  {n.name}
                </Link>
                {idx < navLinks.length - 1 && (
                  <hr className="w-8 border-t border-[var(--color-secondary)]/20" />
                )}
              </React.Fragment>
            ))}
          </nav>

          <div className="mt-8 text-center text-xs text-[var(--color-secondary)]/60">© {new Date().getFullYear()} Rubikiai Lux</div>
        </div>
      </aside>
    </>
  );
}

// Componente principal exportado con Suspense
export default function Header() {
  return (
    <Suspense fallback={<HeaderFallback />}>
      <HeaderContent />
    </Suspense>
  );
}

// Fallback simple mientras carga
function HeaderFallback() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[var(--color-background-main)]/20 backdrop-blur-sm">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 md:px-6 py-3 md:py-1 flex items-center justify-between">
        <div className="w-[120px] md:w-[80px]" />
        <div className="flex-1 flex justify-center">
          <div className="w-28 h-10 bg-gray-200/20 rounded animate-pulse" />
        </div>
        <div className="w-[120px] md:w-[140px]" />
      </div>
    </header>
  );
}