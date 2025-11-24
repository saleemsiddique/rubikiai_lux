// components/AboutSection.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const AboutSection: React.FC = () => {
  const [isTextVisible, setIsTextVisible] = useState(false);
  const [isCard1Visible, setIsCard1Visible] = useState(false);
  const [isCard2Visible, setIsCard2Visible] = useState(false);

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
    <section className="relative w-full py-6 md:py-8 bg-gradient-to-br from-[var(--color-background-light)] via-[var(--color-background-main)] to-[var(--color-background-light)]">
      <div className="container mx-auto px-6 max-w-7xl">

        {/* Title - Mobile only */}
        <h2 className="lg:hidden font-serif text-2xl md:text-3xl text-[var(--color-highlight)] font-bold leading-tight pb-3 md:pb-6 text-center">
          Šiaurietiškas poilsis <span className="md:inline block">kūnui ir sielai</span>
        </h2>

        {/* HERO IMAGE + INTRO TEXT */}
        <div className="flex flex-col lg:flex-row items-start gap-6 md:gap-10 mb-10 md:mb-16">
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
            <h2 className="hidden lg:block font-serif text-3xl lg:text-4xl text-[var(--color-highlight)] text-center font-bold leading-tight">
              Šiaurietiškas poilsis <br /> kūnui ir sielai
            </h2>

            <p
              className={`text-base md:text-lg lg:text-xl font-bolder text-deep-green font-bolder leading-relaxed text-center transition-all duration-700 ease-out ${isTextVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-8'
                }`}
              style={{
                transitionDelay: isTextVisible ? '0ms' : '0ms'
              }}
            >
              Kviečiame atvykti pailsėti į skandinaviško stiliaus duplekso apartamentus šalia Rubikių ežero Anykščių rajone. Čia mėgausitės privačia sūkurine vonia - Jacuzzi, iš jos stebėsite vietovės gyventojus elnius – danielius. Jais galėsite grožėtis bei
              pamaitinti, o jie apdovanos Jus nepamirštamomis akimirkomis, sielos terapija ir ramybe...
            </p>
            <p
              className={`text-base md:text-lg lg:text-xl font-bolder text-deep-green leading-relaxed text-center transition-all duration-700 ease-out ${isTextVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-8'
                }`}
              style={{
                transitionDelay: isTextVisible ? '200ms' : '0ms'
              }}
            >
              Norintiems visiško privatumo - prabangus Ežero Namelis dviems gamtos glėbyje, tik 10 žingsnių iki ežero ir miško…
            </p>
            <p
              className={`text-base md:text-lg lg:text-xl font-bolder text-deep-green leading-relaxed text-center transition-all duration-700 ease-out ${isTextVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-8'
                }`}
              style={{
                transitionDelay: isTextVisible ? '400ms' : '0ms'
              }}
            >
              Papildykite savo viešnagę ežero pramogomis – ramiais pasiplaukiojimais valtimi ar vandens dviračiu, o gal įsimintinais baidarių nuotykiais...
            </p>
          </div>
        </div>

        {/* ACCOMMODATIONS - 2 cards with background images */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-8 md:mb-12">

          {/* EŽERO NAMELIS - slide from left */}
          <Link
            ref={card1Ref}
            href="/ezero-namelis"
            className={`group relative rounded-2xl shadow-lg overflow-hidden min-h-[300px] md:min-h-[350px] flex flex-col justify-end transition-all duration-1000 ease-out ${isCard1Visible
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 -translate-x-12'
              }`}
          >
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
              <img
                src="/ezero-namelis/ezero-namelis (19).jpg"
                alt="Ežero Namelis background"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/20"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 p-6 md:p-8 space-y-1">
              <h3 className="font-serif text-xl md:text-3xl lg:text-4xl text-white font-bold group-hover:text-[var(--color-primary)] transition-colors duration-300 border-b-2 border-transparent group-hover:border-[var(--color-primary)] inline-block drop-shadow-lg">
                Ežero Namelis →
              </h3>
              <p className="text-xs md:text-sm text-white/90 font-light leading-relaxed drop-shadow-md">
                Žavingas, atskiras poilsio namelis ant ežero kranto – Tai tobulas pabėgimas su nuostabiausiais saulėlydžiais, žvaigždėtomis naktimis ir tyliais rytais...
              </p>
            </div>
          </Link>

          {/* DUPLEKSO APARTAMENTAI - slide from right */}
          <Link
            ref={card2Ref}
            href="/dupleksas"
            className={`group relative rounded-2xl shadow-lg overflow-hidden min-h-[300px] md:min-h-[350px] flex flex-col justify-end transition-all duration-1000 ease-out ${isCard2Visible
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 -translate-x-12'
              }`}
          >
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
              <img
                src="/dupleksas/1-dupleksas8.jpg"
                alt="Dupleksas background"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/20"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 p-6 md:p-8 space-y-1">
              <h3 className="font-serif text-xl md:text-3xl lg:text-4xl text-white font-bold group-hover:text-[var(--color-primary)] transition-colors duration-300 border-b-2 border-transparent group-hover:border-[var(--color-primary)] inline-block drop-shadow-lg">
                Duplekso apartamentai <br />Nr. 1 ir Nr. 2 →
              </h3>

              <p className="text-xs md:text-sm text-white/90 font-light leading-relaxed drop-shadow-md">
                Du stilingi apartamentai, siūlantys skandinavišką komfortą ir modernius patogumus elniukų draugijoje…
              </p>
            </div>
          </Link>
        </div>

      </div>
    </section>
  );
};

export default AboutSection;