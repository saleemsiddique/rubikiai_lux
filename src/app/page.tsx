// pages/index.tsx
import React from 'react';
import HeroSection from '../components/HeroSection';
import AboutSection from '../components/AboutSection';
import AccommodationsSection from '../components/Accommodations';

const HomePage: React.FC = () => {
  return (
    <div className="bg-cream-bg">
      <main>
        <HeroSection />
        <AboutSection />
        <AccommodationsSection />
      </main>
      {/* Puedes agregar un Footer aquí */}
    </div>
  );
};

export default HomePage;
