// components/AboutSection.tsx
import React from 'react';

const AboutSection: React.FC = () => {
  return (
    <section className="relative w-full py-24 bg-gradient-to-br from-[var(--color-background-light)] via-[var(--color-background-main)] to-[var(--color-background-light)]">
      <div className="container mx-auto flex flex-col lg:flex-row items-center lg:items-stretch gap-16 lg:gap-24 px-6">

        {/* Left - Large Image */}
        <div className="relative lg:w-1/2 w-full rounded-3xl overflow-hidden shadow-2xl max-h-[600px]">
          <img
            src="/home/IMG_0634-1.jpeg"
            alt="Rubikiai Lux prie ežero"
            className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent max-h-[600px]"></div>
        </div>

        {/* Right - Text Content */}
        <div className="flex flex-col justify-center lg:w-1/2 space-y-8 text-left">
          {/* Title */}
          <h4 className="font-serif text-3xl md:text-3xl text-[var(--color-highlight)] font-bold leading-tight">
            Šiaurietiškas poilsis kūnui ir sielai
          </h4>

          {/* Intro */}
          <p className="text-base md:text-lg font-light text-deep-green leading-relaxed">
            Kviečiame atvykti pailsėti į skandinaviško stiliaus duplekso apartamentus šalia Rubikių ežero Anykščių rajone. Čia mėgausitės privačia sūkurine vonia - Jacuzzi, iš jos stebėsite vietovės gyventojus elnius – danielius. Jais galėsite grožėtis bei pamaitinti, o jie apdovanos Jus nepamirštamomis akimirkomis, sielos terapija ir ramybe...
          </p>

          <p className="text-base md:text-lg font-light text-deep-green leading-relaxed">
            Norintiems visiško privatumo - prabangus Ežero Namelis dviems gamtos glėbyje, tik 10 žingsnių iki ežero ir miško…
          </p>

          {/* Details */}
          <div className="space-y-6 pt-4">
            <div>
              <h3 className="font-serif text-2xl text-[var(--color-highlight)] mb-3">Ežero Namelis</h3>
              <p className="text-base text-deep-green font-light leading-relaxed">
                Žavingas, atskiras poilsio namelis ant ežero kranto – Tai tobulas pabėgimas su nuostabiausiais saulėlydžiais, žvaigždėtomis naktimis ir tyliais rytais...
              </p>
            </div>
            <div>
              <h3 className="font-serif text-2xl text-[var(--color-highlight)] mb-3">Duplekso apartamentai Nr. 1 ir Nr. 2</h3>
              <p className="text-base text-deep-green font-light leading-relaxed">
                Du stilingi apartamentai, siūlantys skandinavišką komfortą ir modernius patogumus elniukų draugijoje…
              </p>
            </div>
          </div>

          {/* Experiences */}
          <div className="pt-6 border-t border-[var(--color-highlight)]">
            <p className="text-base md:text-lg text-deep-green font-light leading-relaxed">
              Papildykite savo viešnagę ežero pramogomis – ramiais pasiplaukiojimais valtimi ar vandens dviračiu, o gal įsimintinais baidarių nuotykiais...
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;