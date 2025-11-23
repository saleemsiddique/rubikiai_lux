// components/Footer.tsx
import React from "react";
import Link from "next/link";

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full mt-12 border-t border-[#2a4850] bg-[var(--color-secondary)] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Grid con Quick Links destacados y resto de información */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-8">
          
          {/* Quick Links - Destacado */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider border-b border-[var(--color-primary)] pb-2 inline-block">
              Navigate
            </h3>
            <nav className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 mt-6">
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
            </nav>
          </div>

          {/* Información de contacto */}
          <div>
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider border-b border-[var(--color-primary)] pb-2 inline-block">
              Contact
            </h3>
            <div className="space-y-5 text-sm mt-6">
              <div>
                <p className="font-bold text-white text-base mb-1">Haroldas Aukštikalnis</p>
                <p className="text-xs text-gray-400 leading-relaxed">Veikla pagal verslo liudijimą</p>
                <p className="text-xs text-gray-400 leading-relaxed">Licencija Nr. AP-3287</p>
              </div>
              
              <div className="space-y-2 pt-1">
                <p className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">✉</span>
                  <a 
                    href="mailto:info@rubikiailux.lt" 
                    className="text-gray-400 hover:text-white transition-colors font-medium"
                  >
                    info@rubikiailux.lt
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">☎</span>
                  <a 
                    href="tel:+37064632972" 
                    className="text-gray-400 hover:text-white transition-colors font-medium"
                  >
                    +370 646 32 972
                  </a>
                </p>
              </div>
              
              <div className="pt-1">
                <p className="text-xs text-gray-400 leading-relaxed">Piliakalnio vs 1.</p>
                <p className="text-xs text-gray-400 leading-relaxed">Anykščių raj. LT-29203, Lithuania</p>
              </div>
            </div>
          </div>
        </div>

        {/* Línea divisoria */}
        <div className="border-t border-[#2a4850] pt-6">
          <div className="text-center text-xs text-white tracking-wide">
            © {year} Rubikiai Lux. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;