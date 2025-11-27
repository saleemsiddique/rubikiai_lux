// app/dupleksas/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const DuplexSelectionPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[var(--color-background-soft)] pt-20 md:pt-32 px-4 pb-8 flex flex-col">
      {/* Simple Header */}
      <div className="text-center mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold text-[var(--color-text)] font-header mb-2">
          Duplekso Apartamentai
        </h1>
        <div className="w-20 h-1 bg-[var(--color-primary)] mx-auto"></div>
      </div>

      {/* Two Options - Side by Side on Desktop, Stacked on Mobile */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-7xl mx-auto w-full">
        
        {/* Option 1 */}
        <Link 
          href="/dupleksas/salia-elniu-aptvaro"
          className="group relative overflow-hidden rounded-xl block"
        >
          <div className="bg-[var(--color-secondary)] p-4 md:p-6 text-center">
            <div className="w-12 h-1 bg-[var(--color-primary)] mb-3 mx-auto"></div>
            <h2 className="text-xl md:text-2xl font-bold text-white group-hover:text-[var(--color-primary)] transition-colors font-header">
              Nr.1 - Šalia Elnių Aptvaro
            </h2>
          </div>
          
          <div className="relative block">
            <Image
              src="/dupleksas/1-dupleksas8.jpg"
              alt="Nr.1 - Šalia Elnių Aptvaro"
              width={800}
              height={600}
              className="w-full h-auto block transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </Link>

        {/* Option 2 */}
        <Link 
          href="/dupleksas/salia-elniu-panorama"
          className="group relative overflow-hidden rounded-xl"
        >
          <div className="bg-[var(--color-secondary)] p-4 md:p-6 text-center">
            <div className="w-12 h-1 bg-[var(--color-primary)] mb-3 mx-auto"></div>
            <h2 className="text-xl md:text-2xl font-bold text-white group-hover:text-[var(--color-primary)] transition-colors font-header">
              Nr.2 - Elnių Panorama
            </h2>
          </div>
          
          <div className="relative">
            {/* Mobile image */}
            <Image
              src="/dupleksas/2-dupleksas9.jpeg"
              alt="Nr.2 - Elnių Panorama"
              width={800}
              height={600}
              className="w-full h-auto transition-transform duration-500 group-hover:scale-105 md:hidden"
            />
            {/* Desktop image */}
            <Image
              src="/dupleksas/2-dupleksas8.jpeg"
              alt="Nr.2 - Elnių Panorama"
              width={800}
              height={600}
              className="w-full h-auto transition-transform duration-500 group-hover:scale-105 hidden md:block"
            />
          </div>
        </Link>

      </div>
    </div>
  );
};

export default DuplexSelectionPage;