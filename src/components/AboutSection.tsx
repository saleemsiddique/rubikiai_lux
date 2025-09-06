// components/AboutSection.tsx
import React from 'react';

const AboutSection: React.FC = () => {
  return (
    <section className="container mx-auto px-6 py-24 text-center">
      <div className="flex flex-col lg:flex-row items-center justify-between">
        {/* Texto Izquierdo */}
        <div className="lg:w-1/3 text-lg md:text-xl text-deep-green mb-8 lg:mb-0 lg:pr-8">
          <p className="font-light leading-relaxed">
            Nuestros alojamientos están diseñados para ser un santuario de tranquilidad y elegancia. Cada rincón refleja un cuidado meticuloso por los detalles, garantizando una estancia inolvidable.
          </p>
        </div>
        
        {/* Imagen Circular */}
        <div className="lg:w-1/3 flex justify-center">
          <div className="w-64 h-64 rounded-full overflow-hidden shadow-2xl">
            <img 
              src="/images/your-circular-image.jpg" // Reemplaza con una imagen adecuada
              alt="Sobre nosotros" 
              className="w-full h-full object-cover" 
            />
          </div>
        </div>

        {/* Texto Derecho */}
        <div className="lg:w-1/3 text-lg md:text-xl text-deep-green mt-8 lg:mt-0 lg:pl-8">
          <p className="font-light leading-relaxed">
            Ya sea que busques la serenidad junto al lago o la comodidad de un moderno dúplex, te invitamos a sumergirte en una experiencia de lujo discreto, donde cada visita se convierte en una historia personal.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;