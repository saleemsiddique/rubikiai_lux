'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import AboutSection from '@/components/AboutSection';

const ReservationForm = dynamic(() => import('@/components/ReservationForm'), { ssr: false });

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-[var(--color-background-soft)] overflow-hidden">
      {/* HERO SECTION */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image - Parallax */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: 'url("/home/IMG_6656-1.jpeg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            transform: `translateY(${scrollY * 0.5}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />

        {/* Dark Overlay */}
        <div
          className="absolute inset-0 bg-black/50"
          style={{
            opacity: Math.min(scrollY / 300, 0.5) + 0.35,
          }}
        />

        {/* Content */}
        <div className="relative z-20 text-center px-4 pointer-events-auto">
          {/* Title */}
          <div
            style={{
              opacity: Math.max(1 - scrollY / 400, 0),
              transform: `translateY(${scrollY * 0.3}px)`,
              transition: 'all 0.1s ease-out',
            }}
          >
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-widest text-[var(--color-background-soft)] drop-shadow-2xl mb-8">
              RUBIKIAI LUX
            </h1>
          </div>

          {/* Reservation Button */}
          <button
            onClick={() => router.push("/reservations")}
            className="relative z-30 px-8 py-3 cursor-pointer md:px-12 md:py-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold text-lg tracking-wide transition-all duration-300 hover:shadow-2xl hover:scale-105"
            style={{
              opacity: Math.max(1 - scrollY / 300, 0),
              transform: `translateY(${scrollY * 0.2}px) scale(${Math.max(1 - scrollY / 500, 0.8)})`,
            }}
          >
            REZERVUOTI
          </button>
        </div>

        <style jsx>{`
          section {
            background-attachment: fixed;
          }
        `}</style>
      </section>

      <AboutSection></AboutSection>


      {/* FULLSCREEN IMAGE WITH CTA */}
      <section className="relative w-full min-h-screen h-auto flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 w-full h-full min-h-screen"
          style={{
            backgroundImage: 'url("/home/inicio-2.avif")',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundAttachment: typeof window !== 'undefined' && window.innerWidth > 768 ? 'fixed' : 'scroll',
          }}
        />

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/40" />

        {/* CTA Content */}
        {/*<div className="relative z-20 text-center px-6 py-20 md:py-0">
          <h3 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6 drop-shadow-2xl">
            Atraskite savo kitą prieglobstį
          </h3>
          <p className="text-lg md:text-2xl font-light text-white/90 max-w-3xl mx-auto mb-10 drop-shadow-lg">
            Rubikiai Lux rasite tobulą pusiausvyrą tarp gamtos, komforto ir prabangos. Kiekviena detalė sukurta jūsų visiškam atsipalaidavimui.
          </p>
          <button
            onClick={() => {
              const element = document.getElementById('about-section');
              element?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-12 py-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold text-lg tracking-wide transition-all duration-300 hover:shadow-2xl hover:scale-105"
          >
            REZERVUOKITE SAVO PATIRTĮ
          </button>
        </div>*/}

        <style jsx>{`
          @media (min-width: 768px) {
            section {
              background-attachment: fixed;
            }
          }
        `}</style>
      </section>
    </div>
  );
}