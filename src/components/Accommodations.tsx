// components/AccommodationsSection.tsx
import React from "react";
import Link from "next/link";

interface AccommodationProps {
  name: string;
  description: string;
  image: string;
  href: string;         // ← ruta que indicas tú
  newTab?: boolean;     // ← opcional: abrir en nueva pestaña
}

const AccommodationCard: React.FC<AccommodationProps> = ({
  name,
  description,
  image,
  href,
  newTab = false,
}) => {
  // Si es un http(s) externo y no forzaste newTab, lo abrimos en nueva pestaña automáticamente
  const isExternal = /^https?:\/\//i.test(href);
  const openInNewTab = newTab || isExternal;

  return (
    <Link
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
      aria-label={`Open ${name}`}
      className="relative flex-1 w-full group overflow-hidden block focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      style={{
        backgroundImage: `url(${image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Oscurecimiento en la parte inferior */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Contenido con animación */}
      <div className="absolute inset-0 bg-deep-green bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-500 flex flex-col items-center justify-end p-8">
        <h3 className="text-white text-3xl font-bold mb-2 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-in-out">
          {name}
        </h3>
        <p className="text-white text-sm text-center opacity-0 group-hover:opacity-100 transform translate-y-full group-hover:translate-y-0 transition-all duration-500 delay-150 ease-in-out">
          {description}
        </p>
      </div>
    </Link>
  );
};

const AccommodationsSection: React.FC = () => {
  const accommodations: AccommodationProps[] = [
    {
      name: "Lake House",
      description:
        "A peaceful retreat with panoramic lake views, perfect for unwinding and reconnecting with nature.",
      image: "/ezero-namelis/lake-house1.png",
      href: "/ezero-namelis", // ← tu ruta interna
    },
    {
      name: "Duplex (No.1 & No.2)",
      description:
        "Two modern and cozy duplexes, ideal for groups of up to 4 people each, equipped with all the necessary amenities.",
      image: "/dupleksas/dupleksas1.png",
      href: "/dupleksas", // ← tu ruta interna
    },
  ];

  return (
    <section className="flex flex-col sm:flex-row w-full h-[60vh] sm:h-screen">
      {accommodations.map((acc, index) => (
        <AccommodationCard key={index} {...acc} />
      ))}
    </section>
  );
};

export default AccommodationsSection;
