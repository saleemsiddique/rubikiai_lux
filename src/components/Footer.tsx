// components/Footer.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhoneIcon, InboxIcon, Globe } from "lucide-react";
import { useTranslations, useLocale } from 'next-intl';
import { locales, localeNames } from "@/i18n/config";

const Footer: React.FC = () => {
  const year = new Date().getFullYear();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();

  // Get current path without locale prefix
  const getPathWithoutLocale = () => {
    const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/';
    return pathWithoutLocale;
  };

  const switchLanguage = (newLocale: string) => {
    const pathWithoutLocale = getPathWithoutLocale();
    const newPath = pathWithoutLocale === '/' ? `/${newLocale}` : `/${newLocale}${pathWithoutLocale}`;
    window.location.href = newPath;
  };

  return (
    <footer className="w-full border-t border-[#2a4850] bg-[var(--color-secondary)] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Grid con Quick Links destacados y resto de información */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-8">

          {/* Quick Links - Destacado */}
          <div className="lg:col-span-2 text-center">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider border-b border-[var(--color-primary)] pb-2 inline-block">
              {t('navigate')}
            </h3>
            <nav className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 mt-6 text-lg">
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
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity mr-1">→</span>
                {t('houseRules')}
              </Link>
              <Link
                href={`/${locale}/privacy-policy`}
                className="text-[var(--color-primary)] hover:text-white hover:translate-x-1 transition-all duration-200 font-normal flex items-center group"
              >
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
          </div>

          {/* Información de contacto */}
          <div className="text-center">
            <Link href={`/${locale}/contact`}>
              <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider border-b border-[var(--color-primary)] pb-2 inline-block cursor-pointer hover:text-[var(--color-primary)] transition-colors">
                {t('contact')}
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

        {/* Language Selector */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[var(--color-primary-dark)]/20 rounded-full p-1 backdrop-blur-sm">
            <Globe className="w-4 h-4 text-[var(--color-primary)] ml-2" />
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => switchLanguage(loc)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  locale === loc
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