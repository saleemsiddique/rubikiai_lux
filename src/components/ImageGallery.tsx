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
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const hasMoreImages = displayedCount < images.length;

  const showMoreImages = () => {
    setDisplayedCount(prevCount => prevCount + initialDisplayCount);
  };

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
  };

  const closeLightbox = () => {
    setSelectedImageIndex(null);
  };

  const goToNext = () => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex + 1) % images.length);
    }
  };

  const goToPrevious = () => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex - 1 + images.length) % images.length);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') goToNext();
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'Escape') closeLightbox();
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
              <div
                key={index}
                className={`group relative w-full h-64 overflow-hidden rounded-lg shadow-md cursor-pointer ${fadingClass}`}
                onClick={() => openLightbox(index)}
              >
                <Image
                  src={src}
                  alt={`Gallery Image ${index + 1}`}
                  layout="fill"
                  objectFit="cover"
                  className="transition-transform duration-300 group-hover:scale-105"
                />

                {/* Overlay con texto al hacer hover */}
                <div className="
                  absolute inset-0 
                  bg-black/50 bg-opacity-50 
                  flex items-center justify-center
                  opacity-0 group-hover:opacity-100
                  transition-opacity duration-300
                ">
                  <span className="text-white text-lg font-sans font-semibold">
                    View image in full size
                  </span>
                </div>
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

      {/* Lightbox */}
      {selectedImageIndex !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white text-4xl font-bold hover:text-gray-300 transition-colors z-50"
            aria-label="Close"
          >
            ×
          </button>

          {/* Previous button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-4 text-white text-5xl font-bold hover:text-gray-300 transition-colors z-50"
            aria-label="Previous"
          >
            ‹
          </button>

          {/* Image */}
          <div
            className="relative w-full h-full flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative max-w-7xl max-h-full w-full h-full">
              <Image
                src={images[selectedImageIndex]}
                alt={`Gallery Image ${selectedImageIndex + 1}`}
                layout="fill"
                objectFit="contain"
                className="rounded-lg"
              />
            </div>
          </div>

          {/* Next button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-4 text-white text-5xl font-bold hover:text-gray-300 transition-colors z-50"
            aria-label="Next"
          >
            ›
          </button>

          {/* Image counter */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-lg font-sans">
            {selectedImageIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGallery;