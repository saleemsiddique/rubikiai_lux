// components/Footer.tsx
import React from "react";
import Link from "next/link";
import { PhoneIcon, InboxIcon } from "lucide-react";

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-[#2a4850] bg-[var(--color-secondary)] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Grid con Quick Links destacados y resto de información */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-8">

          {/* Quick Links - Destacado */}
          <div className="lg:col-span-2 text-center">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider border-b border-[var(--color-primary)] pb-2 inline-block">
              Navigate
            </h3>
            <nav className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 mt-6 text-lg">
              <Link
                href="/"
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                Home
              </Link>
              <Link
                href="/reservations"
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                Reservation
              </Link>
              <Link
                href="/coupons"
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                Coupons
              </Link>
              <Link
                href="/house-rules"
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                House Rules
              </Link>
              <Link
                href="/privacy-policy"
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                Privacy Policy
              </Link>
              <Link
                href="/faq"
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                FAQ
              </Link>
            </nav>
          </div>

          {/* Información de contacto */}
          <div className="text-center">
            <Link href="/contact">
              <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider border-b border-[var(--color-primary)] pb-2 inline-block cursor-pointer hover:text-[var(--color-primary)] transition-colors">
                Contact
              </h3>
            </Link>
            <div className="space-y-5 text-sm mt-2">

              <p className="flex items-center gap-2 text-center justify-center">
                <InboxIcon className="w-4 h-4 text-gray-400" />
                <a
                  href="mailto:info@rubikiailux.lt"
                  className="text-gray-400 hover:text-white transition-colors font-medium"
                >
                  info@rubikiailux.lt
                </a>
              </p>

              <p className="flex items-center gap-2 text-center justify-center">
                <PhoneIcon className="w-4 h-4 text-gray-400" />
                <a
                  href="tel:+37064632972"
                  className="text-gray-400 hover:text-white transition-colors font-medium"
                >
                  +370 646 32 972
                </a>
              </p>


              <div className="pt-3">
                <p className="text-xs text-gray-400 leading-relaxed">Piliakalnio vs 1.</p>
                <p className="text-xs text-gray-400 leading-relaxed">Anykščių raj. LT-29203, Lithuania</p>
              </div>
            </div>
          </div>
        </div>

        {/* Línea divisoria */}
        <div className="border-t border-[#2a4850] pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-gray-400">
            <div className="text-center md:text-left">
              <span className="text-white">© {year} Rubikiai Lux.</span> All rights reserved.
            </div>
            <div className="text-center md:text-right">
              Veikla pagal verslo liudijimą · Licencija Nr. AP-3287
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;