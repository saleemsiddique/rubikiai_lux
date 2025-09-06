// components/AccommodationsSection.tsx
import React from 'react';

interface AccommodationProps {
  name: string;
  description: string;
  image: string;
}

const AccommodationCard: React.FC<AccommodationProps> = ({ name, description, image }) => {
  return (
    <div 
      className="relative flex-1 w-full group overflow-hidden" 
      style={{ backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Overlay oscuro y contenido */}
      <div 
        className="absolute inset-0 bg-deep-green bg-opacity-0 group-hover:bg-opacity-80 transition-all duration-500 flex flex-col items-center justify-end p-8"
      >
        <h3 className="text-cream-bg text-3xl font-bold mb-2 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-in-out">{name}</h3>
        <p 
          className="text-cream-bg text-sm text-center opacity-0 group-hover:opacity-100 transform translate-y-full group-hover:translate-y-0 transition-all duration-500 delay-150 ease-in-out"
        >
          {description}
        </p>
      </div>
    </div>
  );
};

const AccommodationsSection: React.FC = () => {
  const accommodations = [
    {
      name: "Lake House",
      description: "Un refugio tranquilo con vistas panorámicas al lago, ideal para desconectar y conectar con la naturaleza.",
      image: "/images/lake-house.jpg", // Reemplaza con tu imagen
    },
    {
      name: "Dúplex Urbano",
      description: "Modernidad y confort en el corazón de la ciudad. Perfecto para escapadas de fin de semana.",
      image: "/images/duplex-1.jpg", // Reemplaza con tu imagen
    },
    {
      name: "Dúplex de Montaña",
      description: "Elegancia rústica en un entorno de montaña. Amplios espacios y calidez para toda la familia.",
      image: "/images/duplex-2.jpg", // Reemplaza con tu imagen
    },
  ];

  return (
    <section className="flex flex-col sm:flex-row w-full h-[60vh] sm:h-screen"> {/* Altura responsiva */}
      {accommodations.map((acc, index) => (
        <AccommodationCard
          key={index}
          name={acc.name}
          description={acc.description}
          image={acc.image}
        />
      ))}
    </section>
  );
};

export default AccommodationsSection;