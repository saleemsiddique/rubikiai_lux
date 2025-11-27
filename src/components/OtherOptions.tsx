// components/OtherOptions.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';

const OtherOptions: React.FC = () => {
  const pathname = usePathname();

  const otherProperties = [
    {

      name: 'N°1 Šalia Elnių Aptvaro',
      path: '/dupleksas/salia-elniu-aptvaro',
      image: '/dupleksas/1-dupleksas10.jpeg',
    },
    {
      name: 'N°2 Elnių Panorama',
      path: '/dupleksas/salia-elniu-panorama',
      image: '/dupleksas/2-dupleksas8.jpeg',
    },
    {
      name: 'EŽERO NAMELIS',
      path: '/ezero-namelis',
      image: '/ezero-namelis/ezero-namelis (19).jpg',
    },
  ];

  const filteredProperties = otherProperties.filter(
    (prop) => prop.path !== pathname
  );

  return (
    <section className="pt-6 pb-10 md:py-8">
      <div className="container mx-auto px-4">
        {/* Título - Centrado en móvil, izquierda en desktop */}
        <div className="flex justify-center justify-between items-center mb-6 sm:mb-6">
          <h3 className="text-3xl md:text-3xl font-bold font-header text-[var(--color-secondary)]">
            Other options
          </h3>
        </div>

        {/* Cards - Centradas en móvil, scroll horizontal en desktop */}
        <div className="flex flex-col items-center justify-center sm:flex-row sm:justify-center sm:items-stretch gap-6 sm:gap-4 sm:overflow-x-auto sm:pb-4 min-h-[400px] sm:min-h-0">
          {filteredProperties.map((prop) => (
            <Link
              key={prop.path}
              href={prop.path}
              className="w-64 h-56 sm:flex-none group"
            >
              <div className="relative w-full h-full rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
                {/* Imagen de fondo */}
                <Image
                  src={prop.image}
                  alt={typeof prop.name === 'string' ? prop.name : 'Property image'}
                  fill
                  style={{ objectFit: 'cover' }}
                  className="group-hover:scale-110 transition-transform duration-500"
                />

                {/* Overlay oscuro en la parte inferior */}
                {/*<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>*/}

                {/* Texto sobre la imagen */}
                <div className="absolute bottom-0 left-0 right-0 p-2 z-10">
                  <span className="text-base font-semibold text-white drop-shadow-lg leading-tight ml-1">
                    {prop.name}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OtherOptions;