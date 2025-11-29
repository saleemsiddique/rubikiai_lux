"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Refs for rAF scroll handling + hysteresis
  const lastYRef = useRef<number>(0);
  const tickingRef = useRef<boolean>(false);
  const scrolledRef = useRef<boolean>(false);

  const SCROLL_DOWN_THRESHOLD = 60; // entra a scrolled
  const SCROLL_UP_THRESHOLD = 40; // sale de scrolled

  const pageTitles: Record<string, string> = {
    "/": "INICIO",
    "/dupleksas": "DUPLEKSAS",
    "/ezero-namelis": "EŽERO NAMELIS",
    "/reservations": "RESERVATIONS",
    "/coupons": "COUPONS",
    "/faq": "FAQ",
    "/contact": "CONTACT",
  };

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Dupleksas", href: "/dupleksas" },
    { name: "EŽERO NAMELIS", href: "/ezero-namelis" },
    { name: "Reservations", href: "/reservations" },
    { name: "Coupons", href: "/coupons" },
    { name: "FAQ", href: "/faq" },
    { name: "Contact", href: "/contact" },
  ];

  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Check if we're on home page
  const isHomePage = pathname === "/";

  // --- Smooth rAF-based scroll handling with hysteresis ---
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
          // else keep prev to avoid toggle when near threshold

          if (next !== prev) {
            scrolledRef.current = next;
            setScrolled(next);
          }
          tickingRef.current = false;
        });
      }
    }

    // attach passive listener (cheap) + rAF decouples work
    window.addEventListener("scroll", onScroll, { passive: true });
    // init state
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
  }, [pathname, close]);

  // lock body overflow when drawer open
  useEffect(() => {
    if (isOpen) document.body.classList.add("overflow-hidden");
    else document.body.classList.remove("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, [isOpen]);

  // detecta si estamos en pantallas "desktop" (md = 768px en Tailwind)
const [isDesktop, setIsDesktop] = useState<boolean>(false);

useEffect(() => {
  if (typeof window === "undefined") return;
  const mq = window.matchMedia("(min-width: 768px)");
  const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsDesktop(e.matches);
  // set initial
  setIsDesktop(mq.matches);
  // compat: addEventListener en la spec moderna, addListener en navegadores viejos
  if (typeof mq.addEventListener === "function") mq.addEventListener("change", handler);
  else mq.addListener(handler);
  return () => {
    if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", handler);
    else mq.removeListener(handler);
  };
}, []);


  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onClick(e: MouseEvent) {
      if (!drawerRef.current) return;
      if (isOpen && !drawerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [isOpen, close]);

// mostrar si estamos en home y (es escritorio OR no está scrolleado)
// -> en desktop lo mostramos siempre; en móviles solo si no está scrolleado
const showMobileReservationButton = isHomePage && (isDesktop || !scrolled);


  return (
    <>
      <header
        // kept padding stable to avoid layout jumps (same padding both states)
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-400 ease-in-out`}
        style={{
          // we transition properties that are GPU-friendly (background-color, backdrop-filter, box-shadow, opacity)
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
          willChange: "background-color, box-shadow, backdrop-filter, opacity",
        }}
      >
        {/* Visual container with consistent height to avoid layout jumps.
            We layer a "visual" background that changes with scrolled state via classes. */}
        <div
          className={`max-w-screen-xl mx-auto px-4 sm:px-6 md:px-6 py-3 md:py-1 flex items-center justify-between transition-all duration-400`}
        >
          <div className="flex items-center gap-2 md:gap-2 min-w-[120px] md:min-w-[80px]">
            <button
              aria-expanded={isOpen}
              aria-label={isOpen ? "Close navigation" : "Open navigation"}
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

          {/* Logo: kept in DOM and positioned absolutely on small screens always (no layout toggles).
    Visual changes (opacity/scale) handled via CSS transitions only. */}
          <div className="flex-1 flex justify-center items-center pointer-events-none p-1">
            <Link href="/" className="block pointer-events-auto">
              <div
                className={`transform transition-all duration-400 will-change-transform will-change-opacity ${scrolled ? "opacity-100 scale-100" : "opacity-0 scale-95"
                  }`}
                style={{
                  // keep transform/opacity animated; avoid switching between absolute/relative
                  transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <Image
                  src="/rubikiai-logo (1).png"
                  alt="Rubikiai Lux Logo"
                  width={120}
                  height={40}
                  priority
                  className="h-auto drop-shadow-2xl w-22 md:w-28"
                  style={{ transition: "all 400ms cubic-bezier(0.4,0,0.2,1)" }}
                />
              </div>
            </Link>
          </div>

          {/* RIGHT BUTTON - BOOK
              Always in DOM; on mobile we toggle opacity/pointer-events so layout doesn't reflow. */}
          <button
            onClick={() => showMobileReservationButton && (window.location.href = '/reservations')}
            disabled={!showMobileReservationButton}
            className={`uppercase tracking-wider text-[10px] md:text-[14px] px-4 py-2 md:px-5 md:py-2.5 rounded font-semibold transition-all duration-300 ease-in-out flex items-center justify-center min-w-[84px] md:min-w-[100px] ${!showMobileReservationButton ? "cursor-default" : "cursor-pointer"
              }`}
          >
            <span
              className={`transition-all duration-300 rounded px-4 py-1 ${scrolled
                  ? "border-2 border-[var(--color-secondary)] text-[var(--color-secondary)] hover:bg-[var(--color-secondary)] hover:text-white"
                  : "border-2 border-white/80 md:border-[var(--color-secondary)] text-white md:text-[var(--color-secondary)] hover:bg-white md:hover:bg-[var(--color-secondary)] hover:text-[var(--color-secondary)] md:hover:text-white backdrop-blur-sm"
                }`}
              style={{
                opacity: showMobileReservationButton ? 1 : 0,
                pointerEvents: showMobileReservationButton ? "auto" : "none",
                transitionProperty: "opacity, transform",
              }}
            >
              Reserve
            </span>
          </button>
        </div>

        {/* Visual overlay that changes background + shadow based on scrolled (no layout changes) */}
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
              aria-label="Close menu"
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
