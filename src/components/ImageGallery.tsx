// components/ImageGallery.tsx
"use client";

import React, { useState } from 'react';
import Image from 'next/image';

interface ImageGalleryProps {
  images: string[];
  initialDisplayCount?: number;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, initialDisplayCount = 6 }) => {
  const [displayedCount, setDisplayedCount] = useState(initialDisplayCount);
  const hasMoreImages = displayedCount < images.length;

  const showMoreImages = () => {
    setDisplayedCount(prevCount => prevCount + initialDisplayCount);
  };

  const imagesToDisplay = images.slice(0, displayedCount);

  return (
    <div className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8 font-header">Gallery</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {imagesToDisplay.map((src, index) => {
            const isFadingImage = hasMoreImages && index >= displayedCount - 3;
            const fadingClass = isFadingImage ? 'opacity-20' : '';
            
            return (
              <div key={index} className={`relative w-full h-64 overflow-hidden rounded-lg shadow-md ${fadingClass}`}>
                <Image
                  src={src}
                  alt={`Gallery Image ${index + 1}`}
                  layout="fill"
                  objectFit="cover"
                  className="transition-transform duration-300 hover:scale-105"
                />
              </div>
            );
          })}
        </div>
        {hasMoreImages && (
          <div className="text-center mt-8">
            <button
              onClick={showMoreImages}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold py-3 px-8 rounded-full transition-colors font-sans"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGallery;