// components/AboutSection.tsx
import React from 'react';

const AboutSection: React.FC = () => {
  return (
    <section className="relative w-full py-24 bg-gradient-to-br from-[var(--color-background-light)] via-[var(--color-background-main)] to-[var(--color-background-light)]">
      <div className="container mx-auto flex flex-col lg:flex-row items-center lg:items-stretch gap-16 lg:gap-24 px-6">

        {/* Left - Large Image */}
        <div className="relative lg:w-1/2 w-full rounded-3xl overflow-hidden shadow-2xl">
          <img
            src="/home/renos.png"
            alt="Rubikiai Lux by the lake"
            className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        </div>

        {/* Right - Text Content */}
        <div className="flex flex-col justify-center lg:w-1/2 space-y-10 text-left">
          {/* Title */}
          <h2 className="font-serif text-4xl md:text-5xl text-[var(--color-highlight)] leading-tight">
            Where Nature Meets Luxury
          </h2>

          {/* Intro */}
          <p className="text-lg md:text-l font-light text-deep-green leading-relaxed">
            Nordic-style relaxation for body and soul in every season...
            Relax in Scandinavian-style duplex apartments by Lake Rubikiai in the Anykščiai district. Here you can
            enjoy your private SPA hot tub (Jacuzzi) and watch the local residents—fallow deer—right from it. You
            can feed them, and they’ll reward you with unforgettable moments, soothing therapy for the soul, and
            peace...
            For those seeking complete privacy—our luxurious Lake Cabin for two, embraced by nature, just 10 steps
            from the lake and forest...          
          </p>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h3 className="font-serif text-2xl text-[var(--color-highlight)] mb-2">Lake House</h3>
              <p className="text-base text-deep-green font-light">
                A charming standalone retreat with panoramic lake views — the perfect hideaway for serene mornings and starry nights.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-2xl text-[var(--color-highlight)] mb-2">Duplex Nº1 & Nº2</h3>
              <p className="text-base text-deep-green font-light">
                Two stylish apartments offering Scandinavian comfort and modern amenities, each ideal for up to four guests.
              </p>
            </div>
          </div>

          {/* Experiences */}
          <div className="pt-4 border-t border-[var(--color-highlight)]">
            <p className="text-lg text-deep-green font-light">
              Enhance your stay with curated lake activities — from peaceful kayaking adventures to indulgent moments in our private outdoor jacuzzi.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
