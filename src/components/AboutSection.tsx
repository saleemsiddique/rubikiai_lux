// components/AboutSection.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

const AboutSection: React.FC = () => {
  const [isTextVisible, setIsTextVisible] = useState(false);
  const [isCard1Visible, setIsCard1Visible] = useState(false);
  const [isCard2Visible, setIsCard2Visible] = useState(false);
  const locale = useLocale();
  const t = useTranslations('about');
  const tCommon = useTranslations('common');

  const textRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLAnchorElement>(null);
  const card2Ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.2,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (entry.target === textRef.current) {
            setIsTextVisible(true);
          } else if (entry.target === card1Ref.current) {
            setIsCard1Visible(true);
          } else if (entry.target === card2Ref.current) {
            setIsCard2Visible(true);
          }
        }
      });
    }, observerOptions);

    if (textRef.current) observer.observe(textRef.current);
    if (card1Ref.current) observer.observe(card1Ref.current);
    if (card2Ref.current) observer.observe(card2Ref.current);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative w-full">
      {/* Top section with bg-secondary */}
      <div className="bg-[var(--color-secondary)] py-6 md:py-8">
        <div className="container mx-auto px-6 max-w-7xl">
          {/* Title - Mobile only */}
          <h2 className="lg:hidden  text-xl md:text-3xl text-white font-bold leading-tight pb-3 md:pb-6 text-center">
            {t('title')}
          </h2>

          {/* HERO IMAGE + INTRO TEXT */}
          <div className="flex flex-col lg:flex-row items-start gap-6 md:gap-10">
            <div className="w-full lg:w-1/2 rounded-3xl overflow-hidden shadow-2xl h-[45vh] md:h-[400px] lg:h-[500px]">
              <img
                src="/home/IMG_0634-1.jpeg"
                alt="Rubikiai Lux prie ežero"
                className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>

            {/* Text with staggered paragraph animations */}
            <div
              ref={textRef}
              className="w-full lg:w-1/2 space-y-4 md:space-y-5"
            >
              {/* Title - visible on desktop only, centered on mobile */}
              <h2 className="hidden lg:block  text-3xl lg:text-4xl text-white text-center font-bold leading-tight">
                {t('title')}
              </h2>

              <p
                className={`text-base md:text-lg lg:text-xl font-bolder text-white font-bolder leading-relaxed text-center transition-all duration-700 ease-out ${isTextVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 -translate-y-8'
                  }`}
                style={{
                  transitionDelay: isTextVisible ? '0ms' : '0ms'
                }}
              >
                {t('paragraph1')}
              </p>
              <p
                className={`text-base md:text-lg lg:text-xl font-bolder text-white leading-relaxed text-center transition-all duration-700 ease-out ${isTextVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 -translate-y-8'
                  }`}
                style={{
                  transitionDelay: isTextVisible ? '200ms' : '0ms'
                }}
              >
                {t('paragraph2')}
              </p>
              <p
                className={`text-base md:text-lg lg:text-xl font-bolder text-white leading-relaxed text-center transition-all duration-700 ease-out ${isTextVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 -translate-y-8'
                  }`}
                style={{
                  transitionDelay: isTextVisible ? '400ms' : '0ms'
                }}
              >
                {t('paragraph3')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Accommodations section - NO background color */}
      <div className="py-8 md:py-12">
        <div className="container mx-auto px-6 max-w-7xl">
          {/* ACCOMMODATIONS - 2 cards with background images */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">

            {/* EŽERO NAMELIS - slide from left */}
            <Link
              ref={card1Ref}
              href={`/${locale}/ezero-namelis`}
              className={`group transition-all duration-1000 ease-out ${isCard1Visible
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 -translate-x-12'
                }`}
            >
              {/* Image Container */}
              <div className="relative rounded-2xl shadow-lg overflow-hidden min-h-[300px] md:min-h-[350px] mb-4">
                {/* Background Image */}
                <img
                  src="/ezero-namelis/ezero-namelis (14).jpeg"
                  alt="Ežero Namelis"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {/* Title inside image - bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">

                  {/* Dark gradient overlay solo detrás del título y botón */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>

                  {/* DESKTOP/TABLET */}
                  <h3 className="relative hidden md:flex text-xl md:text-2xl lg:text-4xl text-white font-bold group-hover:text-[var(--color-primary)] transition-colors duration-300 drop-shadow-2xl">
                    {t('ezeroNamelis')} →
                  </h3>

                  {/* MÓVIL: título izquierda + "More" derecha */}
                  <div className="relative md:hidden flex items-center justify-between">
                    <h3 className="text-xl text-white font-bold drop-shadow-2xl">
                      {t('ezeroNamelis')}
                    </h3>

                    <span className="px-2 py-[2px] text-xs font-semibold text-white bg-black/20 border border-white backdrop-blur-sm">
                      {tCommon('more')}
                    </span>
                  </div>

                </div>
              </div>

              {/* Description below with decoration */}
              <div className="px-2">
                {/* Decorative line */}
                <div className="w-16 h-1 bg-[var(--color-primary)] mb-3 transition-all duration-300 group-hover:w-24"></div>

                <p className="text-base text-[var(--color-text)] leading-relaxed">
                  {t('ezeroNamelisDesc')}
                </p>
              </div>
            </Link>


            {/* DUPLEKSO APARTAMENTAI - slide from right */}
            <Link
              ref={card2Ref}
              href={`/${locale}/dupleksas`}
              className={`group transition-all duration-1000 ease-out ${isCard2Visible
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 -translate-x-15'
                }`}
            >
              {/* Image Container */}
              <div className="relative rounded-2xl shadow-lg overflow-hidden mb-4">
                {/* Background Image */}
                <img
                  src="/dupleksas/1-dupleksas6.jpeg"
                  alt="Duplekso apartamentai"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 md:hidden"
                />
                <img
                  src="/dupleksas/1-dupleksas6.jpeg"
                  alt="Duplekso apartamentai"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 hidden md:block"
                />

                {/* Title inside image - bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">

                  {/* Dark translucent overlay solo detrás del título y botón */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>

                  {/* DESKTOP/TABLET */}
                  <h3 className="relative hidden md:flex text-xl md:text-2xl lg:text-4xl text-white font-bold group-hover:text-[var(--color-primary)] transition-colors duration-300 drop-shadow-2xl">
                    {t('dupleksoApartamentai')} →
                  </h3>

                  {/* MÓVIL: título izquierda + "More" derecha */}
                  <div className="relative md:hidden flex items-center justify-between">
                    <h3 className="text-xl text-white font-bold drop-shadow-2xl">
                      {t('dupleksoApartamentai')}
                    </h3>

                    <span className="px-2 py-[2px] text-xs font-semibold text-white bg-black/20 border border-white backdrop-blur-sm">
                      {tCommon('more')}
                    </span>
                  </div>
                </div>



              </div>

              {/* Description below with decoration */}
              <div className="px-2">
                {/* Decorative line */}
                <div className="w-16 h-1 bg-[var(--color-primary)] mb-3 transition-all duration-300 group-hover:w-24"></div>

                <p className="text-base text-[var(--color-text)] leading-relaxed">
                  {t('dupleksoApartamentaiDesc')}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;