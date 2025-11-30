"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { FaCheck } from 'react-icons/fa';

type AmenitiesSection = {
  title: string;
  items: string[];
};

interface AmenitiesSectionProps {
  amenitiesSections: AmenitiesSection[];
}

export default function AmenitiesSection({ amenitiesSections }: AmenitiesSectionProps) {
  const t = useTranslations('housePage');
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Stagger the animation of cards - one by one
            amenitiesSections.forEach((_, idx) => {
              setTimeout(() => {
                setVisibleCards((prev) => [...prev, idx]);
              }, idx * 600); // Increased delay for better sequential effect
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [amenitiesSections]);

  if (amenitiesSections.length === 0) return null;

  return (
    <section ref={sectionRef} className="py-16 px-4 md:py-20 relative bg-[#1b343b]">
      {/* Decorative elements with subtle patterns */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#bfa58b]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#8f6e52]/5 rounded-full blur-3xl" />

      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 50px),
                           repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 50px)`
        }}
      />

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-block mb-4">
            <div className="h-1 w-20 bg-[#bfa58b] mx-auto mb-4" />
            <h2 className="text-3xl md:text-5xl font-bold font-header text-[#f4efe9]">
              {t('amenities')}
            </h2>
          </div>
          <p className="text-[#f4efe9]/80 text-lg mt-4 max-w-2xl mx-auto">
            {t('amenitiesSubtitle')}
          </p>
        </div>

        {/* Amenities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {amenitiesSections.map((section, idx) => (
            <div
              key={section.title}
              className={`group relative bg-[#f4efe9] p-6 md:p-8 rounded-2xl hover:shadow-2xl transition-all duration-700 border-2 border-[#bfa58b]/30 hover:border-[#bfa58b] overflow-hidden ${
                visibleCards.includes(idx)
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-16'
              }`}
              style={{
                boxShadow: '8px 0 20px -8px rgba(27, 52, 59, 0.5), 0 10px 30px -10px rgba(27, 52, 59, 0.4)',
                transition: 'all 0.7s ease-out'
              }}
            >
              {/* Dark gradient overlay on right side */}
              <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-l from-[#1b343b]/15 via-[#1b343b]/5 to-transparent pointer-events-none" />

              {/* Decorative corner accent - visible by default */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#bfa58b]/20 to-transparent rounded-bl-full transition-all duration-300 group-hover:from-[#bfa58b]/40" />

              {/* Card Header */}
              <div className="relative mb-6 pb-4 border-b-2 border-[#bfa58b]/30 group-hover:border-[#bfa58b] transition-colors duration-300">
                <h3 className="text-xl md:text-2xl font-bold font-header text-[#1b343b] group-hover:text-[#8f6e52] transition-colors duration-300">
                  {section.title}
                </h3>
              </div>

              {/* Amenities List */}
              <ul className="relative space-y-4">
                {section.items.map((item, itemIdx) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 group/item"
                    style={{
                      animation: visibleCards.includes(idx)
                        ? `fadeInItem 0.4s ease-out ${0.05 * itemIdx}s both`
                        : 'none'
                    }}
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#bfa58b]/30 flex items-center justify-center mt-0.5 group-hover/item:bg-[#bfa58b] transition-all duration-300">
                      <FaCheck className="text-[#1b343b] text-xs group-hover/item:text-white transition-colors duration-300" />
                    </div>
                    <span className="text-[#1b343b] text-[17px] md:text-lg leading-relaxed font-medium group-hover/item:text-[#8f6e52] transition-colors duration-300">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Hover glow effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#bfa58b]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />

              {/* Dark shadow accent on right edge - more prominent */}
              <div className="absolute top-0 right-0 bottom-0 w-2 bg-gradient-to-b from-[#1b343b]/30 via-[#1b343b]/50 to-[#1b343b]/30 opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Additional inner shadow on right */}
              <div 
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  boxShadow: 'inset -10px 0 15px -10px rgba(27, 52, 59, 0.3)'
                }}
              />
            </div>
          ))}
        </div>

        {/* Bottom decorative element */}
        <div className="mt-16 flex justify-center">
          <div className="h-1 w-32 bg-gradient-to-r from-transparent via-[#bfa58b] to-transparent" />
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInItem {
          from {
            opacity: 0;
            transform: translateX(-200px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </section>
  );
}