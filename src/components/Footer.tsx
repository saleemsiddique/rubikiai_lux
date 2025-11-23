// components/Footer.tsx
import React from "react";
import Link from "next/link";

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full mt-12 border-t border-neutral-700 bg-[var(--color-secondary)] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Grid con Quick Links destacados y resto de información */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-8">
          
          {/* Quick Links - Destacado */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-semibold text-neutral-400 mb-6 uppercase tracking-widest">
              Navigate
            </h3>
            <nav className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
              <Link 
                href="/" 
                className="text-base text-neutral-100 hover:text-[var(--color-primary)] transition-colors font-medium"
              >
                Home
              </Link>
              <Link 
                href="/reservations" 
                className="text-base text-neutral-100 hover:text-[var(--color-primary)] transition-colors font-medium"
              >
                Reservation
              </Link>
              <Link 
                href="/coupons" 
                className="text-base text-neutral-100 hover:text-[var(--color-primary)] transition-colors font-medium"
              >
                Coupons
              </Link>
              <Link 
                href="/house-rules" 
                className="text-base text-neutral-100 hover:text-[var(--color-primary)] transition-colors font-medium"
              >
                House Rules
              </Link>
              <Link 
                href="/privacy-policy" 
                className="text-base text-neutral-100 hover:text-[var(--color-primary)] transition-colors font-medium"
              >
                Privacy Policy
              </Link>
            </nav>
          </div>

          {/* Información de contacto */}
          <div>
            <h3 className="text-xs font-semibold text-neutral-400 mb-6 uppercase tracking-widest">
              Contact
            </h3>
            <div className="space-y-4 text-sm text-neutral-300">
              <div>
                <p className="font-medium text-neutral-100">Haroldas Aukštikalnis</p>
                <p className="text-xs mt-1 text-neutral-500">Veikla pagal verslo liudijimą</p>
                <p className="text-xs text-neutral-500">Licencija Nr. AP-3287</p>
              </div>
              <div className="space-y-1 pt-2">
                <p>
                  <a 
                    href="mailto:info@rubikiailux.lt" 
                    className="hover:text-[var(--color-primary)] transition-colors"
                  >
                    info@rubikiailux.lt
                  </a>
                </p>
                <p>
                  <a 
                    href="tel:+37064632972" 
                    className="hover:text-[var(--color-primary)] transition-colors"
                  >
                    +370 646 32 972
                  </a>
                </p>
              </div>
              <div className="pt-2">
                <p className="text-xs text-neutral-500">Piliakalnio vs 1.</p>
                <p className="text-xs text-neutral-500">Anykščių raj. LT-29203, Lithuania</p>
              </div>
            </div>
          </div>
        </div>

        {/* Línea divisoria */}
        <div className="border-t border-neutral-800 pt-6">
          <div className="text-center text-xs text-neutral-500 tracking-wide">
            © {year} Rubikiai Lux. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;