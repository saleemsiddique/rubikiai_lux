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
      path: '/dupleksas/elniu-aptvaro',
      image: '/dupleksas1.png',
    },
    {
      name: 'Duplex N°2 - Elnių Panorama',
      path: '/dupleksas/elniu-panorama',
      image: '/dupleksas2.png',
    },
    {
      name: 'EŽERO NAMELIS',
      path: '/ezero-namelis',
      image: '/lake-house1.png',
    },
  ];

  const filteredProperties = otherProperties.filter(
    (prop) => prop.path !== pathname
  );

  return (
    <section className="bg-gray-100 py-12">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold font-header text-[var(--color-primary-dark)]">Other options</h3>
          {/* Los botones de navegación que pediste */}
          <div className="flex space-x-2">
            <button className="p-2 border rounded-full text-gray-600 hover:text-[var(--color-primary)] hover:bg-gray-200 transition-colors">
              <FaArrowLeft />
            </button>
            <button className="p-2 border rounded-full text-gray-600 hover:text-[var(--color-primary)] hover:bg-gray-200 transition-colors">
              <FaArrowRight />
            </button>
          </div>
        </div>
        <div className="flex space-x-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
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