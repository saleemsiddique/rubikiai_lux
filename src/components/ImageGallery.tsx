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
  const [imageLoading, setImageLoading] = useState(false);
  const hasMoreImages = displayedCount < images.length;

  // --- Cambiado: ahora acepta un incremento y se asegura de no superar images.length
  const showMoreImages = (increment = initialDisplayCount) => {
    setDisplayedCount(prev => Math.min(prev + increment, images.length));
  };

  const openLightbox = (index: number) => {
    setImageLoading(true);
    setSelectedImageIndex(index);
  };

  const closeLightbox = () => {
    setSelectedImageIndex(null);
    setImageLoading(false);
  };

  const goToNext = () => {
    if (selectedImageIndex !== null) {
      setImageLoading(true);
      setSelectedImageIndex((selectedImageIndex + 1) % images.length);
    }
  };

  const goToPrevious = () => {
    if (selectedImageIndex !== null) {
      setImageLoading(true);
      setSelectedImageIndex((selectedImageIndex - 1 + images.length) % images.length);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') goToNext();
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'Escape') closeLightbox();
  };

  const imagesToDisplay = images.slice(0, displayedCount);
  const mobileDisplayLimit = 3;
  // Mostrar en móvil hasta `mobileDisplayLimit` mientras haya más; cuando no haya más, mostrar todo lo que hay en displayedCount
  const mobileImagesToShow = images.slice(0, Math.min(displayedCount, hasMoreImages ? mobileDisplayLimit : displayedCount));

  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8 font-header">Gallery</h2>
        
        {/* Mobile: Grid normal con 3 imágenes normales + 1 con botón */}
        <div className="grid grid-cols-1 gap-6 md:hidden">
          {mobileImagesToShow.map((src, index) => (
            <div
              key={index}
              className="group relative w-full overflow-hidden rounded-lg shadow-md cursor-pointer"
              onClick={() => openLightbox(index)}
            >
              <Image
                src={src}
                alt={`Gallery Image ${index + 1}`}
                width={800}
                height={600}
                className="transition-transform duration-300 group-hover:scale-105 w-full h-auto object-cover"
                style={{ 
                  width: '100%',
                  height: 'auto',
                  display: 'block'
                }}
              />

              <div className="
                absolute inset-0 
                bg-black/50
                flex items-center justify-center
                opacity-0 group-hover:opacity-100
                transition-opacity duration-300
              ">
                <span className="text-white text-lg font-sans font-semibold">
                  View image in full size
                </span>
              </div>
            </div>
          ))}

          {/* Última imagen con botón Load More superpuesto - solo en móvil */}
          {hasMoreImages && (
            <div
              className="group relative w-full overflow-hidden rounded-lg shadow-md"
            >
              <Image
                src={imagesToDisplay[mobileDisplayLimit] || imagesToDisplay[0]}
                alt={`Gallery Image ${mobileDisplayLimit + 1}`}
                width={800}
                height={600}
                className="opacity-30 w-full h-auto object-cover"
                style={{ 
                  width: '100%',
                  height: 'auto',
                  display: 'block'
                }}
              />

              {/* Botón Load More superpuesto */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // --- Cambiado: para móvil cargamos todas las imágenes restantes de una vez.
                    // Si prefieres cargar por trozos en móvil usa: showMoreImages(mobileDisplayLimit)
                    showMoreImages(images.length);
                  }}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold py-3 px-8 rounded-full transition-colors font-sans z-10"
                >
                  Load more
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Desktop: Masonry layout con columns CSS */}
        <div className="hidden md:block columns-2 lg:columns-3 gap-6 space-y-6">
          {imagesToDisplay.map((src, index) => (
            <div
              key={index}
              className="group relative w-full overflow-hidden rounded-lg shadow-md cursor-pointer break-inside-avoid mb-6"
              onClick={() => openLightbox(index)}
            >
              <Image
                src={src}
                alt={`Gallery Image ${index + 1}`}
                width={800}
                height={600}
                className="transition-transform duration-300 group-hover:scale-105 w-full h-auto object-cover"
                style={{ 
                  width: '100%',
                  height: 'auto',
                  display: 'block'
                }}
              />

              <div className="
                absolute inset-0 
                bg-black/50
                flex items-center justify-center
                opacity-0 group-hover:opacity-100
                transition-opacity duration-300
              ">
                <span className="text-white text-lg font-sans font-semibold">
                  View image in full size
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Botón Load More para desktop */}
        {hasMoreImages && (
          <div className="hidden md:block text-center mt-8">
            <button
              onClick={() => showMoreImages()}
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
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white text-4xl font-bold hover:text-gray-300 transition-colors z-50"
            aria-label="Close"
          >
            ×
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-2 md:left-4 text-white text-6xl md:text-7xl font-bold hover:text-gray-300 transition-colors z-50 px-4 py-8"
            aria-label="Previous"
          >
            ‹
          </button>

          <div
            className="relative flex items-center justify-center"
            style={{
              width: '100%',
              height: '100%',
              maxWidth: 'calc(100vw - 8rem)',
              maxHeight: 'calc(100vh - 8rem)',
            }}
          >
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-gray-300 border-t-white rounded-full animate-spin"></div>
              </div>
            )}

            <Image
              src={images[selectedImageIndex]}
              alt={`Gallery Image ${selectedImageIndex + 1}`}
              width={1920}
              height={1080}
              className="rounded-lg"
              style={{
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                opacity: imageLoading ? 0 : 1,
                transition: 'opacity 0.3s ease-in-out',
              }}
              onLoadingComplete={() => setImageLoading(false)}
            />
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-2 md:right-4 text-white text-6xl md:text-7xl font-bold hover:text-gray-300 transition-colors z-50 px-4 py-8"
            aria-label="Next"
          >
            ›
          </button>

          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-lg font-sans">
            {selectedImageIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGallery;
