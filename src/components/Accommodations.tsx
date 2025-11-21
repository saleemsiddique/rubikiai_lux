// components/AccommodationsSection.tsx
import React from "react";
import Link from "next/link";

interface AccommodationProps {
  name: string;
  description: string;
  image: string;
  href: string;
  newTab?: boolean;
}

const AccommodationCard: React.FC<AccommodationProps> = ({
  name,
  description,
  image,
  href,
  newTab = false,
}) => {
  const isExternal = /^https?:\/\//i.test(href);
  const openInNewTab = newTab || isExternal;

  return (
    <div className="flex-1 px-4 sm:px-8 py-8">
      <Link
        href={href}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        aria-label={`View ${name}`}
        className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        {/* Imagen con marco elegante */}
        <div className="relative overflow-hidden rounded-2xl shadow-2xl mb-6 aspect-[4/3] bg-neutral-100">
          {/* Borde decorativo */}
          <div className="absolute inset-0 border-4 border-white/20 rounded-2xl z-10 pointer-events-none" />
          
          {/* Imagen */}
          <div
            className="absolute inset-0 bg-cover bg-center transform group-hover:scale-110 transition-transform duration-700 ease-out"
            style={{
              backgroundImage: `url(${image})`,
            }}
          />
          
          {/* Overlay sutil en hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        {/* Contenido de texto */}
        <div className="text-center px-4">
          <h3 className="text-[var(--color-primary-dark)] text-2xl md:text-3xl font-bold mb-3 group-hover:text-[var(--color-primary)] transition-colors duration-300">
            {name}
          </h3>
          <p className="text-neutral-600 text-sm md:text-base leading-relaxed max-w-md mx-auto">
            {description}
          </p>
          
          {/* Indicador de "ver más" */}
          <div className="mt-4 inline-flex items-center text-[var(--color-primary)] text-sm font-semibold group-hover:gap-2 transition-all duration-300">
            <span>Discover More</span>
            <svg 
              className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>
    </div>
  );
};

const AccommodationsSection: React.FC = () => {
  const accommodations: AccommodationProps[] = [
    {
      name: "Lake House",
      description:
        "A peaceful retreat with panoramic lake views, perfect for unwinding and reconnecting with nature.",
      image: "/home/ezero-inicio.jpeg",
      href: "/ezero-namelis",
    },
    {
      name: "Duplex (No.1 & No.2)",
      description:
        "Two modern and cozy duplexes, ideal for groups of up to 4 people each, equipped with all the necessary amenities.",
      image: "/home/dupleksas-inicio.jpeg",
      href: "/dupleksas",
    },
  ];

  return (
    <section className="w-full bg-[var(--color-background-main)]">
      <div className="max-w-7xl mx-auto">
        {/* Título opcional de la sección */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-primary-dark)] mb-4">
            Our Accommodations
          </h2>
          <p className="text-neutral-600 max-w-2xl mx-auto">
            Choose from our exclusive selection of premium properties
          </p>
        </div>

        {/* Grid de alojamientos */}
        <div className="flex flex-col lg:flex-row gap-8">
          {accommodations.map((acc, index) => (
            <AccommodationCard key={index} {...acc} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default AccommodationsSection;