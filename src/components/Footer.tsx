// components/Footer.tsx
import React from "react";
import Link from "next/link";

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full mt-12 border-t border-neutral-300 bg-neutral-800">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Grid con información de contacto y navegación */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-6">
          {/* Información de contacto */}
          <div>
            <h3 className="text-sm font-bold text-[var(--color-primary)] mb-3 uppercase tracking-wide">
              Contact
            </h3>
            <div className="space-y-2 text-sm text-neutral-300">
              <p className="font-semibold text-white">Haroldas Aukštikalnis</p>
              <p>Veikla pagal verslo liudijimą</p>
              <p>Apgyvendinimo paslaugų teikimo</p>
              <p>licencija Nr. AP-3287</p>
              <div className="mt-3 space-y-1">
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
            </div>
          </div>

          {/* Dirección */}
          <div>
            <h3 className="text-sm font-bold text-[var(--color-primary)] mb-3 uppercase tracking-wide">
              Address
            </h3>
            <div className="text-sm text-neutral-300">
              <p>Piliakalnio vs 1.</p>
              <p>Anykščių raj. LT-29203</p>
              <p className="mt-2">Lithuania</p>
            </div>
          </div>

          {/* Navegación */}
          <div>
            <h3 className="text-sm font-bold text-[var(--color-primary)] mb-3 uppercase tracking-wide">
              Quick Links
            </h3>
            <nav className="flex flex-col space-y-2 text-sm text-neutral-300">
              <Link href="/" className="hover:text-[var(--color-primary)] transition-colors">
                Home
              </Link>
              <Link href="/reservations" className="hover:text-[var(--color-primary)] transition-colors">
                Reservation
              </Link>
              <Link href="/coupons" className="hover:text-[var(--color-primary)] transition-colors">
                Coupons
              </Link>
              <Link href="/house-rules" className="hover:text-[var(--color-primary)] transition-colors">
                House Rules
              </Link>
              <Link href="/privacy-policy" className="hover:text-[var(--color-primary)] transition-colors">
                Privacy Policy
              </Link>
            </nav>
          </div>
        </div>

        {/* Línea divisoria */}
        <div className="border-t border-neutral-700 pt-4">
          <div className="text-center text-xs text-neutral-400">
            © {year} Rubikiai Lux — All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;