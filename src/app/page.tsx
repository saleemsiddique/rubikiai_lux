'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import AboutSection from '@/components/AboutSection';

const ReservationForm = dynamic(() => import('@/components/ReservationForm'), { ssr: false });

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isImageVisible, setIsImageVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          setScrollY(currentScrollY);
          setScrolled(currentScrollY > 50);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.2,
      rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target === imageRef.current) {
          setIsImageVisible(true);
        }
      });
    }, observerOptions);

    if (imageRef.current) {
      observer.observe(imageRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const heroHeight = isMounted ? window.innerHeight * 1.3 : 1300;
  const isMobile = isMounted && window.innerWidth <= 768;

  // Opacidad más rápida - desaparece en menos scroll
  const titleOpacity = Math.max(1 - scrollY / (heroHeight * 0.6), 0);
  const imageOpacity = scrollY < heroHeight ? 1 : Math.max(1 - (scrollY - heroHeight) / 200, 0);

  return (
    <div className="bg-[var(--color-background-soft)]">
      {/* HERO SECTION */}
      <section className="relative h-[130vh] md:h-[150vh]">
        {/* Background Image - Desktop */}
        <div
          className="hidden md:block fixed md:absolute top-0 left-0 w-full h-screen md:h-[150vh]"
          style={{
            backgroundImage: 'url("/home/IMG_6656-1.jpeg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center bottom',
            backgroundAttachment: 'scroll',
            transition: 'opacity 0.3s ease-out',
            zIndex: 0,
            opacity: imageOpacity,
          }}
        />

        {/* Background Video - Mobile */}
        <div
          className="block md:hidden fixed top-0 left-0 w-full h-screen flex items-center justify-center overflow-hidden"
          style={{
            transition: 'opacity 0.3s ease-out',
            zIndex: 0,
            opacity: imageOpacity,
          }}
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-auto object-cover"
            style={{
              minHeight: '100%',
            }}
          >
            <source src="/home/video-reno.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Content - Title - Sticky nativo simple */}
        <div
          className="sticky top-[16vh] md:top-[20vh] left-0 right-0 w-full flex items-start md:items-center justify-center pt-1 md:pt-0"
          style={{
            zIndex: 2,
          }}
        >
          <div
            className="relative text-center px-4 pointer-events-auto w-full"
            style={{
              opacity: titleOpacity,
            }}
          >
            <h1 className="font-title text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight md:tracking-widest text-[var(--color-background-soft)] drop-shadow-2xl">
              RUBIKIAI LUX
            </h1>
          </div>
        </div>
      </section>

      <div className="relative z-10 bg-[var(--color-background-soft)]">
        <AboutSection></AboutSection>

        {/* FULLSCREEN IMAGE WITH CTA - Slide up animation */}
        <section
          ref={imageRef}
          className={`relative w-full overflow-hidden transition-all duration-1000 ease-out ${isImageVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-16'
            }`}
        >
          <div className="relative w-full">
            <img
              src="/home/rubikiai_lago.avif"
              alt="Rubikiai Lux"
              className="w-full h-auto"
              style={{
                display: 'block',
                maxWidth: '100%',
                height: 'auto',
              }}
            />
          </div>
        </section>
      </div>

      {/* Floating Reservations Button - Mobile Only - Solo cuando scrolled (header tiene background) */}
      <button
        onClick={() => router.push('/reservations')}
        className={`md:hidden fixed bottom-6 right-6 z-40 bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary-dark)] text-white px-6 py-3 rounded-full shadow-2xl transition-all duration-500 flex items-center gap-2 font-semibold text-sm ${scrolled
            ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
            : 'opacity-0 translate-y-4 pointer-events-none scale-95'
          }`}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Reservations</span>
      </button>
    </div>
  );
}