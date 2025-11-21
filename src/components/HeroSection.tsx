"use client";

import React from 'react';
import dynamic from "next/dynamic";

const ReservationForm = dynamic(() => import("./ReservationForm"), { ssr: false });

const HeroSection: React.FC = () => {

  return (
    <section
      className="relative h-screen flex items-center justify-center text-[var(--color-background-soft)]"
      style={{
        backgroundImage: 'url("/home/IMG_6656-1.jpeg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-[var(--color-highlight)] opacity-40 mt-0 sm:mt-12"></div>

      <style jsx>{`
        section {
          background-attachment: scroll;
        }
        
        @media (min-width: 768px) {
          section {
            background-attachment: fixed;
          }
        }
      `}</style>

      <div className="relative z-10 text-center px-4">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-wide drop-shadow-lg font-header">
          RUBIKIAI LUX SPA APARTMENTS
        </h1>
        <p className="hidden sm:block mt-4 text-lg md:text-xl font-light font-sans">
          MAGIŠKOMS AKIMIRKOMS.
        </p>

        <ReservationForm showResults={false} />
      </div>
    </section>
  );
};

export default HeroSection;