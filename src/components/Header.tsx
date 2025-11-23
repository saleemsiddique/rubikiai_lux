"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Header() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [isOpen]);

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

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? // HEADER SCROLLED  → menos translucido
              "bg-[var(--color-background-main)]/97 backdrop-blur-md shadow-lg py-3 md:py-1"
            : // HEADER TOP  → menos translucido en desktop
              "bg-gradient-to-b from-black/50 to-transparent md:bg-[var(--color-background-main)]/80 md:backdrop-blur-sm py-4 md:py-1"
        }`}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 md:px-6">
          <div className="flex items-center justify-between">
            
            {/* LEFT SIDE */}
            <div className="flex items-center gap-2 md:gap-2 min-w-[120px] md:min-w-[80px]">
              <button
                aria-expanded={isOpen}
                aria-label={isOpen ? "Close navigation" : "Open navigation"}
                onClick={toggle}
                className={`p-2.5 md:p-2 rounded focus:outline-none focus:ring-2 hover:scale-105 transition-all ${
                  scrolled
                    ? "text-[var(--color-highlight)] focus:ring-[var(--color-highlight)]"
                    : "text-white md:text-white focus:ring-white/50 md:focus:ring-white/50"
                }`}
              >
                <svg
                  className="w-7 h-7 md:w-5 md:h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    className={`transition-all duration-200 ${
                      isOpen
                        ? "opacity-0 scale-90"
                        : "opacity-100 scale-100"
                    }`}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                  <g
                    className={`transition-opacity duration-200 ${
                      isOpen ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </g>
                </svg>
              </button>

              <span
                className={`hidden sm:inline-block text-[10px] md:text-[12px] font-light tracking-wide transition-colors ${
                  scrolled
                    ? "text-[var(--color-highlight)]"
                    : "text-white/90 md:text-white drop-shadow-lg"
                }`}
              >
                {pageTitles[pathname] || ""}
              </span>
            </div>

            {/* CENTER LOGO - hidden on mobile when not scrolled */}
            <div className={`flex-1 justify-center ${scrolled ? 'flex' : 'hidden md:flex'}`}>
              <Link href="/" className="block">
                <div
                  className={`transition-all duration-300 ${
                    scrolled ? "opacity-90" : "opacity-75"
                  } hover:opacity-100`}
                >
                  <Image
                    src="/rubikiai-logo.png"
                    alt="Rubikiai Lux Logo"
                    width={120}
                    height={40}
                    priority
                    className={`h-auto drop-shadow-2xl transition-all duration-300 ${
                      scrolled ? "w-32 md:w-38" : "w-32 md:w-32"
                    }`}
                  />
                </div>
              </Link>
            </div>

            {/* RIGHT BUTTON - BOOK */}
            <div className="flex justify-end items-center min-w-[120px] md:min-w-[100px]">
              <Link
                href="/reservations"
                className={`uppercase tracking-wider 
                text-[10px] md:text-[12px] 
                px-5 py-2.5 
                md:px-4 md:py-2 
                rounded font-semibold
                transition-all duration-300 
                ${
                  scrolled
                    ? "border-2 border-[var(--color-highlight)] text-[var(--color-highlight)] hover:bg-[var(--color-highlight)] hover:text-white"
                    : "border-2 border-white/80 md:border-white text-white md:text-white hover:bg-white md:hover:bg-white hover:text-[var(--color-secondary)] md:hover:text-[var(--color-secondary)] backdrop-blur-sm"
                }`}
              >
                Book
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* BACKDROP */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity"
          aria-hidden
        />
      )}

      {/* DRAWER */}
      <aside
        ref={drawerRef}
        className={`fixed top-0 left-0 z-50 h-full w-[85vw] sm:w-3/4 md:w-1/2 lg:w-1/3 max-w-sm bg-[var(--color-background-main)] shadow-2xl transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="relative p-6 md:p-10 min-h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div />
            <button
              onClick={close}
              aria-label="Close menu"
              className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-highlight)] hover:scale-105 transition-transform"
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <nav className="flex-1 flex flex-col justify-center items-center gap-4 px-4">
            {navLinks.map((n, idx) => (
              <React.Fragment key={n.href}>
                <Link
                  href={n.href}
                  onClick={close}
                  className={`w-full text-center font-sans text-[var(--color-highlight)] text-lg md:text-xl font-light hover:text-[var(--color-primary-dark)] transition-colors duration-200 uppercase py-2 ${
                    pathname === n.href
                      ? "text-[var(--color-primary-dark)] font-medium"
                      : ""
                  }`}
                >
                  {n.name}
                </Link>
                {idx < navLinks.length - 1 && (
                  <hr className="w-8 border-t border-[var(--color-highlight)]/20" />
                )}
              </React.Fragment>
            ))}
          </nav>

          <div className="mt-8 text-center text-xs text-[var(--color-highlight)]/60">
            © {new Date().getFullYear()} Rubikiai Lux
          </div>
        </div>
      </aside>
    </>
  );
}