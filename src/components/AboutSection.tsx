// components/AboutSection.tsx
import React from 'react';
import Link from 'next/link';

const AboutSection: React.FC = () => {
  return (
    <section className="relative w-full py-12 md:py-20 bg-gradient-to-br from-[var(--color-background-light)] via-[var(--color-background-main)] to-[var(--color-background-light)]">
      <div className="container mx-auto px-6 max-w-7xl">

        {/* HERO IMAGE + INTRO TEXT */}
        <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-10 mb-10 md:mb-16">
          <div className="w-full lg:w-1/2 rounded-3xl overflow-hidden shadow-2xl h-[45vh] md:h-[400px] lg:h-[500px]">
            <img
              src="/home/IMG_0634-1.jpeg"
              alt="Rubikiai Lux prie ežero"
              className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700 ease-out"
            />
          </div>

          <div className="w-full lg:w-1/2 space-y-4 md:space-y-5">
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-[var(--color-highlight)] font-bold leading-tight">
              Šiaurietiškas poilsis kūnui ir sielai
            </h2>
            <p className="text-sm md:text-base lg:text-lg font-light text-deep-green leading-relaxed">
              Kviečiame atvykti pailsėti į skandinaviško stiliaus duplekso apartamentus šalia Rubikių ežero Anykščių rajone. Čia mėgausitės privačia sūkurine vonia - Jacuzzi, iš jos stebėsite vietovės gyventojus elnius – danielius.
            </p>
            <p className="text-sm md:text-base lg:text-lg font-light text-deep-green leading-relaxed">
              Norintiems visiško privatumo - prabangus Ežero Namelis dviems gamtos glėbyje, tik 10 žingsnių iki ežero ir miško…
            </p>
          </div>
        </div>

        {/* ACCOMMODATIONS - 2 cards with background images */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-8 md:mb-12">

          {/* EŽERO NAMELIS */}
          <Link
            href="/ezero-namelis"
            className="group relative rounded-2xl shadow-lg overflow-hidden min-h-[300px] md:min-h-[350px] flex flex-col justify-end"
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
            <div className="relative z-10 p-6 md:p-8 space-y-3">
              <h3 className="font-serif text-2xl md:text-3xl lg:text-4xl text-white font-bold group-hover:text-[var(--color-primary)] transition-colors duration-300 border-b-2 border-transparent group-hover:border-[var(--color-primary)] pb-2 inline-block drop-shadow-lg">
                Ežero Namelis →
              </h3>
              <p className="text-sm md:text-base text-white/90 font-light leading-relaxed drop-shadow-md">
                Žavingas, atskiras poilsio namelis ant ežero kranto – Tai tobulas pabėgimas su nuostabiausiais saulėlydžiais...
              </p>
            </div>
          </Link>

          {/* DUPLEKSO APARTAMENTAI */}
          <Link
            href="/dupleksas"
            className="group relative rounded-2xl shadow-lg overflow-hidden min-h-[300px] md:min-h-[350px] flex flex-col justify-end"
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
            <div className="relative z-10 p-6 md:p-8 space-y-3">
              <h3 className="font-serif text-2xl md:text-3xl lg:text-4xl text-white font-bold group-hover:text-[var(--color-primary)] transition-colors duration-300 border-b-2 border-transparent group-hover:border-[var(--color-primary)] pb-2 inline-block drop-shadow-lg">
                Duplekso apartamentai →
              </h3>
              <p className="text-sm md:text-base text-white/90 font-light leading-relaxed drop-shadow-md">
                Du stilingi apartamentai, siūlantys skandinavišką komfortą ir modernius patogumus...
              </p>
            </div>
          </Link>
        </div>

        {/* ACTIVITIES TEXT - Simple paragraph */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-base md:text-lg lg:text-xl text-deep-green font-light leading-relaxed">
            Papildykite savo viešnagę ežero pramogomis – ramiais pasiplaukiojimais valtimi ar vandens dviračiu...
          </p>
        </div>

      </div>
    </section>
  );
};

export default AboutSection;