// components/OtherOptions.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa'; // Asegúrate de tener react-icons instalado

const OtherOptions: React.FC = () => {
  const pathname = usePathname();

  const otherProperties = [
    {
      name: 'Duplex N°1 - Šalia Elnių Aptvaro',
      path: '/dupleksas/salia-elniu-aptvaro',
      image: '/dupleksas/1-dupleksas10.jpeg',
    },
    {
      name: 'Duplex N°2 - Elnių Panorama',
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
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold font-header text-[var(--color-primary-dark)]">Other options</h3>
        </div>
        <div
          className="
            grid 
            gap-4 
            justify-center sm:justify-start   /* centrado solo en móvil */
            sm:flex 
            sm:space-x-4 
            sm:overflow-x-auto 
            sm:pb-4
          "
        >

          {filteredProperties.map((prop) => (
            <Link key={prop.path} href={prop.path} className="flex-none w-64">
              <div className="card-soft rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
                <div className="relative w-full h-40">
                  <Image
                    src={prop.image}
                    alt={prop.name}
                    layout="fill"
                    objectFit="cover"
                  />
                </div>
                <div className="p-3 text-center">
                  <span className="font-sans text-sm font-semibold">{prop.name}</span>
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