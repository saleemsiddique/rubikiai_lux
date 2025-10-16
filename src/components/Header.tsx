"use client";

import React, { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Header() {
  const [isOpen, setIsOpen] = React.useState(false);
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

  // Close on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [isOpen]);

  // Close on Escape and handle click outside
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
        className="fixed inset-x-0 top-0 z-50 bg-[var(--color-background-main)]/95 backdrop-blur-sm shadow-sm transition-colors duration-300"
        style={{ WebkitBackdropFilter: "saturate(120%) blur(6px)" }}
      >
        <div className="max-w-screen-xl mx-auto flex items-center justify-between px-4 sm:px-6 md:px-8 py-4 md:py-6">
          {/* LEFT: hamburger + page title */}
          <div className="flex items-center gap-2 md:gap-3">
            <button
              aria-expanded={isOpen}
              aria-label={isOpen ? "Close navigation" : "Open navigation"}
              onClick={toggle}
              className="p-1.5 md:p-2 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-highlight)] hover:scale-105 transition-transform"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  className={`transition-transform duration-200 ${isOpen ? "opacity-0 scale-90" : "opacity-100 scale-100"}`}
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

            <span className="hidden sm:inline-block text-[var(--color-highlight)] text-xs md:text-sm font-light tracking-wide max-w-[140px] truncate">
              {pageTitles[pathname] || ""}
            </span>
          </div>

          {/* CENTER: logo */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none mt-1 md:mt-2">            <Link href="/" className="pointer-events-auto">
            <Image
              src="/rubikiai-logo.png"
              alt="Rubikiai Lux Logo"
              width={140}
              height={35}
              priority
              className="w-24 md:w-36 h-auto"
            />
          </Link>
          </div>

          {/* RIGHT: reservation button */}
          <div className="flex justify-end items-center">
            <Link
              href="/reservations"
              className="hidden md:inline-block font-sans border border-[var(--color-highlight)] text-[var(--color-highlight)] text-xs uppercase tracking-wider py-1.5 px-4 md:py-2 md:px-5 transition-colors duration-300 hover:bg-[var(--color-highlight)] hover:text-[var(--color-background-main)] rounded"
            >
              Reservation
            </Link>
          </div>
        </div>
      </header>

      {/* BACKDROP */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/40 sm:bg-black/30 transition-opacity" aria-hidden />}

      {/* DRAWER */}
      <aside
        ref={drawerRef}
        className={`fixed top-0 left-0 z-50 h-full w-full sm:w-3/4 md:w-1/2 lg:w-1/3 bg-[var(--color-background-main)] shadow-2xl transform transition-transform duration-300 ease-in-out overflow-y-auto ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        aria-hidden={!isOpen}
      >
        <div className="relative p-6 md:p-10 min-h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div />
            <button
              onClick={close}
              aria-label="Close menu"
              className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-highlight)] hover:scale-105 transition-transform"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 flex flex-col justify-center items-center gap-5 px-4">
            {navLinks.map((n, idx) => (
              <React.Fragment key={n.href}>
                <Link
                  href={n.href}
                  onClick={close}
                  className={`w-full text-center font-sans text-[var(--color-highlight)] text-xl md:text-2xl font-light hover:text-[var(--color-primary-dark)] transition-colors duration-200 uppercase py-2 ${pathname === n.href ? "text-[var(--color-primary-dark)] font-medium" : ""}`}
                >
                  {n.name}
                </Link>
                {idx < navLinks.length - 1 && (
                  <hr className="w-10 border-t border-[var(--color-highlight)] opacity-20" />
                )}
              </React.Fragment>
            ))}
          </nav>

          <div className="mt-8 text-center text-xs opacity-60">© {new Date().getFullYear()} Rubikiai</div>
        </div>
      </aside>
    </>
  );
}