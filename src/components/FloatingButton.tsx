'use client';

import React, { useEffect, useState, useRef } from "react";
import { useTranslations } from 'next-intl';

export default function FloatingButton() {
  const t = useTranslations('houses');
  const [scrollY, setScrollY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const lastYRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const mobileHandler = (e: MediaQueryListEvent | MediaQueryList) => 
      setIsMobile(!e.matches);
    setIsMobile(!mq.matches);

    const onScroll = () => {
      lastYRef.current = window.scrollY;
      if (!tickingRef.current) {
        tickingRef.current = true;
        requestAnimationFrame(() => {
          setScrollY(lastYRef.current);
          tickingRef.current = false;
        });
      }
    };

    if (typeof mq.addEventListener === "function") 
      mq.addEventListener("change", mobileHandler);
    else mq.addListener(mobileHandler);
    
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (typeof mq.removeEventListener === "function") 
        mq.removeEventListener("change", mobileHandler);
      else mq.removeListener(mobileHandler);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const scrolled = scrollY > 50;
  const showFloating = isMobile && scrolled;

  return (
    <button
      className={`md:hidden fixed bottom-6 right-6 z-40 bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary-dark)] text-white px-6 py-3 rounded-full shadow-2xl transition-all duration-500 flex items-center gap-2 font-semibold text-sm ${
        scrolled
          ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
          : 'opacity-0 translate-y-4 pointer-events-none scale-95'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'opacity, transform'
      }}
      aria-hidden={!showFloating}
    >
      <span>{t('reserveNow')}</span>
    </button>
  );
}