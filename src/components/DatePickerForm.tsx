// components/DatePickerForm.tsx
"use client";

import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FaCalendarAlt, FaUserFriends, FaChevronDown, FaChevronUp } from 'react-icons/fa';

const DatePickerForm: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [isArrivalPickerOpen, setIsArrivalPickerOpen] = useState(false);
  const [isDeparturePickerOpen, setIsDeparturePickerOpen] = useState(false);

  const onChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);

    if (start && !end) {
      setIsArrivalPickerOpen(false);
      setIsDeparturePickerOpen(true);
    } else if (start && end) {
      setIsDeparturePickerOpen(false);
    }
  };

  const handleGuestsChange = (increment: number) => {
    setGuests(prev => Math.max(1, prev + increment));
  };

  return (
    <div className="card-soft p-6 md:p-8 flex flex-col items-center relative z-10">
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full justify-center items-center">
        {/* Arrival Date */}
        <div className="flex flex-col text-left flex-1 w-full">
          <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Arrival</label>
          <div className="relative flex items-center">
            <DatePicker
              selected={startDate}
              onChange={onChange}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              minDate={new Date()}
              open={isArrivalPickerOpen}
              onClickOutside={() => setIsArrivalPickerOpen(false)}
              onInputClick={() => {
                setIsArrivalPickerOpen(true);
                setIsDeparturePickerOpen(false);
              }}
              customInput={
                <div className="p-2 bg-transparent text-[var(--color-text)] font-sans text-xl cursor-pointer flex items-center">
                  <FaCalendarAlt className="mr-2 text-[var(--color-primary)]" />
                  {startDate ? startDate.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' }) : 'MM/DD'}
                </div>
              }
            />
          </div>
        </div>

        {/* Departure Date */}
        <div className="flex flex-col text-left flex-1 w-full">
          <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Departure</label>
          <div className="relative flex items-center">
            <DatePicker
              selected={endDate}
              onChange={onChange}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              minDate={startDate || new Date()}
              open={isDeparturePickerOpen}
              onClickOutside={() => setIsDeparturePickerOpen(false)}
              onInputClick={() => {
                setIsDeparturePickerOpen(true);
                setIsArrivalPickerOpen(false);
              }}
              customInput={
                <div className="p-2 bg-transparent text-[var(--color-text)] font-sans text-xl cursor-pointer flex items-center">
                  <FaCalendarAlt className="mr-2 text-[var(--color-primary)]" />
                  {endDate ? endDate.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' }) : 'MM/DD'}
                </div>
              }
            />
          </div>
        </div>

        {/* Guests */}
        <div className="flex flex-col text-left flex-1 w-full">
          <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Guests</label>
          <div className="p-2 flex items-center justify-between bg-transparent text-[var(--color-text)] font-sans text-xl">
            <FaUserFriends className="text-[var(--color-primary)]" />
            <div className="w-12 text-center">{guests}</div>
            <div className="flex flex-col space-y-1">
              <button
                onClick={() => handleGuestsChange(1)}
                className="text-lg text-[var(--color-text)] hover:text-[var(--color-primary-dark)]"
              >
                <FaChevronUp />
              </button>
              <button
                onClick={() => handleGuestsChange(-1)}
                className="text-lg text-[var(--color-text)] hover:text-[var(--color-primary-dark)]"
              >
                <FaChevronDown />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Button */}
      <button className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-[var(--color-background-main)] font-bold py-3 px-8 rounded-md transition-colors w-full mt-4 font-sans">
        Reserve
      </button>
    </div>
  );
};

export default DatePickerForm;