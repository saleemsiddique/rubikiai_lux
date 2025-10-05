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
          <p className="text-lg md:text-xl font-light text-deep-green leading-relaxed">
            Perched beside the peaceful Rubikiai Lake, our three exclusive accommodations are designed to blend timeless elegance with the tranquility of nature.
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
