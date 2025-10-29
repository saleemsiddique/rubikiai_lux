// components/Footer.tsx
import React from "react";
import Link from "next/link";

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full mt-12 border-t border-neutral-200 bg-[var(--color-background-main)]">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Navegación compacta */}
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs md:text-sm text-neutral-700">
          <Link href="/" className="hover:text-[var(--color-primary-dark)]">Home</Link>
          <Link href="/reservations" className="hover:text-[var(--color-primary-dark)]">Reservation</Link>
          <Link href="/coupons" className="hover:text-[var(--color-primary-dark)]">Coupons</Link>
          <Link href="/house-rules" className="hover:text-[var(--color-primary-dark)]">House Rules</Link>
          <Link href="/privacy-policy" className="hover:text-[var(--color-primary-dark)]">Privacy</Link>
        </nav>

        {/* Línea legal */}
        <div className="mt-3 text-center text-[11px] md:text-xs text-neutral-500">
          © {year} Rubikiai Lux — All rights are reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
