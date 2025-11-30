// components/Footer.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PhoneIcon, InboxIcon, Globe, Facebook, Instagram } from "lucide-react";
import { useTranslations, useLocale } from 'next-intl';
import { locales, localeNames } from "@/i18n/config";

const Footer: React.FC = () => {
  const year = new Date().getFullYear();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Devuelve el path actual SIN el prefijo de locale (limpio, con leading slash)
  const getPathWithoutLocale = (loc: string) => {
    // eliminar solo el prefijo inicial "/{locale}"
    return pathname.replace(new RegExp(`^/${loc}`), '') || '/';
  };

  // Cambia el idioma preservando query string y hash
  const switchLanguage = (newLocale: string) => {
    // path sin locale
    const pathWithoutLocale = getPathWithoutLocale(locale);

    // reconstruir query string desde useSearchParams (más fiable en SPA)
    const rawSearch = searchParams?.toString() ?? '';
    const search = rawSearch ? `?${rawSearch}` : '';

    // conservar hash si existe (window.location.hash)
    const hash = typeof window !== 'undefined' ? window.location.hash : '';

    // nuevo path: si es root -> '/{newLocale}', si no -> '/{newLocale}{pathWithoutLocale}'
    const newPath = pathWithoutLocale === '/' ? `/${newLocale}` : `/${newLocale}${pathWithoutLocale}`;

    // usar router.push para navegación cliente (mantiene historial y estado)
    router.push(newPath + search + hash);
  };

  return (
    <footer className="w-full border-t border-[#2a4850] bg-[var(--color-secondary)] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Grid con Quick Links destacados y resto de información */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-8">

          {/* Quick Links - Destacado */}
          <div className="lg:col-span-2 flex flex-col items-center">
            {/*<h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider border-b border-[var(--color-primary)] pb-2 inline-block text-center">
              {t('navigate')}
            </h3>*/}

            <nav className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 mt-6 text-lg w-full justify-items-start md:justify-items-center">
              <Link
                href={`/${locale}`}
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                {t('home')}
              </Link>

              <Link
                href={`/${locale}/reservations`}
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                {t('reservations')}
              </Link>

              <Link
                href={`/${locale}/coupons`}
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                {t('coupons')}
              </Link>

              <Link
                href={`/${locale}/house-rules`}
                className={`text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group`}
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                {t('houseRules')}
              </Link>

              <Link
                href={`/${locale}/privacy-policy`}
                className={`text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group ${locale == 'ru' ? 'md:text-lg text-sm' : ''
                  }`}              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                {t('privacyPolicy')}
              </Link>

              <Link
                href={`/${locale}/faq`}
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                {t('faq')}
              </Link>
            </nav>

            {/* Language Selector → Solo desktop debajo de navigation links */}
            <div className="hidden lg:flex justify-center mt-6">
              <div className="inline-flex items-center gap-2 bg-[var(--color-primary-dark)]/20 rounded-full p-1 backdrop-blur-sm">
                <Globe className="w-4 h-4 text-[var(--color-primary)] ml-2" />
                {locales.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => switchLanguage(loc)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${locale === loc
                      ? 'bg-[var(--color-primary)] text-white shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    aria-label={`Switch to ${localeNames[loc as keyof typeof localeNames]}`}
                  >
                    {localeNames[loc as keyof typeof localeNames]}
                  </button>
                ))}
              </div>
            </div>

          </div>


          {/* Información de contacto */}
          <div className="text-center">
            <Link href={`/${locale}/contact`}>
              <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider border-b border-[var(--color-primary)] pb-2 inline-block cursor-pointer hover:text-[var(--color-primary)] transition-colors">
                {t('contact')}
              </h3>
            </Link>

            <div className="space-y-5 text-sm mt-2">

              <p className="flex items-center gap-2 justify-center">
                <InboxIcon className="w-4 h-4 text-gray-400" />
                <a
                  href="mailto:info@rubikiailux.lt"
                  className="text-gray-400 hover:text-white transition-colors font-medium"
                >
                  info@rubikiailux.lt
                </a>
              </p>

              <p className="flex items-center gap-2 justify-center">
                <PhoneIcon className="w-4 h-4 text-gray-400" />
                <a
                  href="tel:+37064632972"
                  className="text-gray-400 hover:text-white transition-colors font-medium"
                >
                  +370 646 32 972
                </a>
              </p>

              <div className="pt-3 space-y-1">
                <p className="text-xs text-gray-400 leading-relaxed">Piliakalnio vs 1.</p>
                <p className="text-xs text-gray-400 leading-relaxed">Anykščių raj. LT-29203, Lithuania</p>
              </div>

              {/* ✅ Social Networks dentro del bloque y centrado */}
              <div className="flex justify-center gap-6 mt-4 pt-2">
                <a
                  href="https://www.instagram.com/rubikiailux"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="text-[var(--color-primary)] hover:text-white transition-all duration-200"
                >
                  <Instagram size={22} strokeWidth={1.5} />
                </a>

                <a
                  href="https://www.facebook.com/RubikiaiLux"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="text-[var(--color-primary)] hover:text-white transition-all duration-200"
                >
                  <Facebook size={22} strokeWidth={1.5} />
                </a>
              </div>

            </div>
          </div>
        </div>


        {/* Language Selector */}
        <div className="flex justify-center mb-8 lg:hidden">
          <div className="inline-flex items-center gap-2 bg-[var(--color-primary-dark)]/20 rounded-full p-1 backdrop-blur-sm">
            <Globe className="w-4 h-4 text-[var(--color-primary)] ml-2" />
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => switchLanguage(loc)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${locale === loc
                  ? 'bg-[var(--color-primary)] text-white shadow-lg'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                aria-label={`Switch to ${localeNames[loc as keyof typeof localeNames]}`}
              >
                {localeNames[loc as keyof typeof localeNames]}
              </button>
            ))}
          </div>
        </div>

        {/* Línea divisoria */}
        <div className="border-t border-[#2a4850] pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-gray-400">
            <div className="text-center md:text-left">
              <span className="text-white">© {year} Rubikiai Lux.</span> {tCommon('allRightsReserved')}.
            </div>
            <div className="text-center md:text-right">
              {tCommon('businessLicense')}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;