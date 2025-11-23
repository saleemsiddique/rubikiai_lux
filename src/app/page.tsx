'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import AboutSection from '@/components/AboutSection';

const ReservationForm = dynamic(() => import('@/components/ReservationForm'), { ssr: false });

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calcular la opacidad del título basado en el scroll
  const heroHeight = isMounted ? window.innerHeight * 1.3 : 1300;
  const titleOpacity = Math.max(1 - scrollY / (heroHeight * 0.4), 0);
  const imageOpacity = scrollY < heroHeight ? 1 : Math.max(1 - (scrollY - heroHeight) / 200, 0);
  const isMobile = isMounted && window.innerWidth <= 768;

  return (
    <div className="bg-[var(--color-background-soft)]">
      {/* HERO SECTION */}
      <section className="relative h-[130vh] md:h-[150vh]">
        {/* Background Image - Fixed in Mobile, scrollable in Desktop */}
        <div
          className="fixed md:absolute top-0 left-0 w-full h-screen md:h-[150vh]"
          style={{
            backgroundImage: 'url("/home/IMG_6656-1.jpeg")',
            backgroundSize: 'cover',
            backgroundPosition: isMobile ? 'center' : 'center bottom',
            backgroundAttachment: 'scroll',
            transition: 'opacity 0.3s ease-out',
            zIndex: 0,
            opacity: imageOpacity,
          }}
        />

        {/* Dark Overlay - Fixed in Mobile */}
        <div
          className="fixed md:absolute top-0 left-0 w-full h-screen md:h-[150vh] bg-black/50"
          style={{
            opacity: 0.35 * imageOpacity,
            zIndex: 1,
            transition: 'opacity 0.3s ease-out',
          }}
        />

        {/* Content - Title */}
        <div 
          className="sticky top-[15vh] md:top-[20vh] h-screen md:h-auto flex items-start md:items-center justify-center pt-12 md:pt-0"
          style={{ zIndex: 2 }}
        >
          <div 
            className="relative text-center px-4 pointer-events-auto w-full"
            style={{
              opacity: titleOpacity,
              transition: 'opacity 0.1s ease-out',
            }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight md:tracking-widest text-[var(--color-background-soft)] drop-shadow-2xl">
              RUBIKIAI LUX
            </h1>
          </div>
        </div>
      </section>
      
      <div className="relative z-10 bg-[var(--color-background-soft)]">
        <AboutSection></AboutSection>

        {/* FULLSCREEN IMAGE WITH CTA */}
        <section className="relative w-full overflow-hidden">
          <div className="relative w-full">
            <img
              src="/home/inicio-2.avif"
              alt="Rubikiai Lux"
              className="w-full h-auto object-contain"
            />

            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-black/40" />
          </div>
        </section>
      </div>
    </div>
  );
}