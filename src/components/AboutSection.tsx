// components/AboutSection.tsx
import React from 'react';

const AboutSection: React.FC = () => {
  return (
    <section className="relative w-full py-12 md:py-24 bg-gradient-to-br from-[var(--color-background-light)] via-[var(--color-background-main)] to-[var(--color-background-light)]">
      <div className="container mx-auto flex flex-col lg:flex-row items-center lg:items-stretch gap-8 md:gap-16 lg:gap-24 px-6">

        {/* Left - Large Image (full height on mobile) */}
        <div className="relative w-full lg:w-2/3 rounded-3xl overflow-hidden shadow-2xl h-[70vh] md:h-[600px] lg:h-[700px]">
          <img
            src="/home/IMG_0634-1.jpeg"
            alt="Rubikiai Lux prie ežero"
            className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        </div>

        {/* Right - Text Content (reduced width) */}
        <div className="flex flex-col justify-center w-full lg:w-1/3 space-y-6 text-left">
          {/* Title */}
          <h4 className="font-serif text-2xl md:text-3xl text-[var(--color-highlight)] font-bold leading-tight">
            Šiaurietiškas poilsis kūnui ir sielai
          </h4>

          {/* Intro */}
          <p className="text-sm md:text-base font-light text-deep-green leading-relaxed">
            Kviečiame atvykti pailsėti į skandinaviško stiliaus duplekso apartamentus šalia Rubikių ežero Anykščių rajone. Čia mėgausitės privačia sūkurine vonia - Jacuzzi, iš jos stebėsite vietovės gyventojus elnius – danielius.
          </p>

          <p className="text-sm md:text-base font-light text-deep-green leading-relaxed">
            Norintiems visiško privatumo - prabangus Ežero Namelis dviems gamtos glėbyje, tik 10 žingsnių iki ežero ir miško…
          </p>

          {/* Details */}
          <div className="space-y-4 pt-2">
            <div>
              <h3 className="font-serif text-xl text-[var(--color-highlight)] mb-2">Ežero Namelis</h3>
              <p className="text-sm text-deep-green font-light leading-relaxed">
                Žavingas, atskiras poilsio namelis ant ežero kranto – Tai tobulas pabėgimas su nuostabiausiais saulėlydžiais...
              </p>
            </div>
            <div>
              <h3 className="font-serif text-xl text-[var(--color-highlight)] mb-2">Duplekso apartamentai</h3>
              <p className="text-sm text-deep-green font-light leading-relaxed">
                Du stilingi apartamentai, siūlantys skandinavišką komfortą ir modernius patogumus...
              </p>
            </div>
          </div>

          {/* Experiences */}
          <div className="pt-4 border-t border-[var(--color-highlight)]">
            <p className="text-sm md:text-base text-deep-green font-light leading-relaxed">
              Papildykite savo viešnagę ežero pramogomis – ramiais pasiplaukiojimais valtimi ar vandens dviračiu...
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;