"use client";

import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ReservationForm from './ReservationForm';

const HeroSection: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [propertyType, setPropertyType] = useState('duplex');
  // Estados separados para controlar cada calendario
  const [openPicker, setOpenPicker] = useState<"arrival" | "departure" | null>(null);


  const onChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);

    if (start && !end) {
      setOpenPicker("departure");
    } else {
      setOpenPicker(null);
    }
  };


  const handleGuestsChange = (increment: number) => {
    setGuests(prev => Math.max(1, prev + increment));
  };

  return (
    <section
      className="relative h-screen flex items-center justify-center text-[var(--color-background-soft)]"
      style={{
        backgroundImage: 'url("/rubikiai_lago.avif")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 bg-[var(--color-highlight)] opacity-40"></div>


      <div className="relative z-10 text-center px-4">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-wide drop-shadow-lg font-header">
          RUBIKIAI LUX SPA APARTMENTS
        </h1>
        <p className="mt-4 text-lg md:text-xl font-light font-sans">
          MAGIŠKOMS AKIMIRKOMS.
        </p>

        <ReservationForm showResults={false} />
      </div>
    </section>
  );
};

export default HeroSection;