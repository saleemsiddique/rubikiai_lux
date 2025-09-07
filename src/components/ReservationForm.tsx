"use client";

import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface ReservationFormProps {
  onReserve?: () => void; // Puedes pasar un callback si quieres manejar el botón "Reserve"
}

const ReservationForm: React.FC<ReservationFormProps> = ({ onReserve }) => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [propertyType, setPropertyType] = useState('duplex');
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
    <div className="card-soft mt-12 p-6 md:p-8 flex flex-col items-center relative z-10">
      {/* Property Type Toggle */}
      <div className="flex justify-center space-x-4 mb-4 z-10 relative">
        <button
          onClick={() => setPropertyType('duplex')}
          className={`px-6 py-2 rounded-full font-sans uppercase text-sm font-bold tracking-wide transition-colors ${
            propertyType === 'duplex'
              ? 'bg-[var(--color-primary)] text-white'
              : 'border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:text-white'
          }`}
        >
          Duplex
        </button>
        <button
          onClick={() => setPropertyType('lake_house')}
          className={`px-6 py-2 rounded-full font-sans uppercase text-sm font-bold tracking-wide transition-colors ${
            propertyType === 'lake_house'
              ? 'bg-[var(--color-primary)] text-white'
              : 'border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:text-white'
          }`}
        >
          Lake House
        </button>
      </div>

      {/* Dates & Guests */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full justify-center items-center">
        {/* Arrival Date */}
        <div className="flex flex-col text-left flex-1 border-r border-[var(--color-primary)] pr-4 w-full">
          <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">
            Arrival
          </label>
          <DatePicker
            selected={startDate}
            onChange={onChange}
            startDate={startDate}
            endDate={endDate}
            selectsRange
            minDate={new Date()}
            open={openPicker === "arrival"}
            onInputClick={() => setOpenPicker("arrival")}
            onClickOutside={() => setOpenPicker(null)}
            customInput={
              <div className="p-2 bg-transparent text-[var(--color-text)] font-sans text-xl cursor-pointer">
                {startDate
                  ? startDate.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' })
                  : 'MM/DD'}
              </div>
            }
          />
        </div>

        {/* Departure Date */}
        <div className="flex flex-col text-left flex-1 border-r border-[var(--color-primary)] pr-4 w-full">
          <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">
            Departure
          </label>
          <DatePicker
            selected={endDate}
            onChange={onChange}
            startDate={startDate}
            endDate={endDate}
            selectsRange
            minDate={startDate || new Date()}
            open={openPicker === "departure"}
            onInputClick={() => setOpenPicker("departure")}
            onClickOutside={() => setOpenPicker(null)}
            customInput={
              <div className="p-2 bg-transparent text-[var(--color-text)] font-sans text-xl cursor-pointer">
                {endDate
                  ? endDate.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' })
                  : 'MM/DD'}
              </div>
            }
          />
        </div>

        {/* Guests */}
        <div className="flex flex-col text-left flex-1 w-full">
          <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">
            Guests
          </label>
          <div className="flex items-center justify-center p-2 bg-transparent text-[var(--color-text)] font-sans text-xl">
            <button
              onClick={() => handleGuestsChange(-1)}
              className="px-2 text-3xl leading-none text-[var(--color-text)] hover:text-[var(--color-primary-dark)]"
            >
              -
            </button>
            <div className="w-12 text-center">{guests}</div>
            <button
              onClick={() => handleGuestsChange(1)}
              className="px-2 text-3xl leading-none text-[var(--color-text)] hover:text-[var(--color-primary-dark)]"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Reserve Button */}
      <button
        onClick={onReserve}
        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-[var(--color-background-main)] font-bold py-3 px-8 rounded-md transition-colors w-full md:w-auto mt-4 md:mt-0 font-sans"
      >
        Reserve
      </button>
    </div>
  );
};

export default ReservationForm;
