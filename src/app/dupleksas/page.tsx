// app/dupleksas/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const DuplexSelectionPage: React.FC = () => {
  return (
    <div className="bg-gray-100 min-h-screen flex flex-col md:flex-row">

      {/* Opción 1: Dúplex N°1 */}
      <Link href="/dupleksas/salia-elniu-aptvaro" className="relative flex-1 group overflow-hidden cursor-pointer h-screen">
        <Image
          src="/dupleksas/1-dupleksas8.jpg"
          alt="Dúplex N°1 - Šalia Elnių Aptvaro"
          layout="fill"
          objectFit="cover"
          className="transition-transform duration-500 ease-in-out group-hover:scale-105"
        />
        {/*<div className="absolute inset-0 bg-black opacity-40 group-hover:opacity-60 transition-opacity"></div>*/}
        <div className="absolute inset-0 flex items-center justify-center text-center text-white p-4">
          <div className="transform transition-transform duration-500 group-hover:scale-110">
            <h2 className="text-2xl md:text-4xl font-extrabold drop-shadow-lg mb-2 font-header">
              Nr.1 - Šalia Elnių Aptvaro
            </h2>
            <p className="text-lg md:text-xl font-light font-sans">
              
            </p>
          </div>
        </div>
      </Link>

      {/* Opción 2: Dúplex N°2 */}
      <Link href="/dupleksas/salia-elniu-panorama" className="relative flex-1 group overflow-hidden cursor-pointer h-screen">
        <Image
          src="/dupleksas/2-dupleksas9.jpeg"
          alt="Dúplex N°2 - Elnių Panorama"
          layout="fill"
          objectFit="cover"
          className="transition-transform duration-500 ease-in-out group-hover:scale-105"
        />
        {/*<div className="absolute inset-0 bg-black opacity-40 group-hover:opacity-60 transition-opacity"></div>*/}
        <div className="absolute inset-0 flex items-center justify-center text-center text-white p-4">
          <div className="transform transition-transform duration-500 group-hover:scale-110">
            <h2 className="text-2xl md:text-4xl font-extrabold drop-shadow-lg mb-2 font-header">
              Nr.2 – Elnių Panorama
            </h2>
            <p className="text-lg md:text-xl font-light font-sans">
              
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default DuplexSelectionPage;