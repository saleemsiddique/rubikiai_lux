"use client";
import React from "react";

interface HouseListProps {
  houses: any[];
}

const HouseList: React.FC<HouseListProps> = ({ houses }) => {
  if (!houses.length) return <p className="mt-6">No houses available</p>;

  return (
    <div className="mt-8 grid md:grid-cols-2 gap-6">
      {houses.map(house => (
        <div key={house.id} className="p-4 border rounded-md bg-[var(--color-background-soft)] flex flex-col">
          <img src={house.images[0]} alt={house.name} className="rounded-md mb-2" />
          <h3 className="font-bold text-[var(--color-primary-dark)]">{house.name}</h3>
          <p className="text-sm text-[var(--color-text)] mb-2">Max Guests: {house.maxGuests}</p>
          <p className="text-sm text-[var(--color-text)] mb-4">{house.description}</p>
          {house.isAvailable && house.isCapacityOk ? (
            <button className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white py-2 px-4 rounded-md">
              Reserve
            </button>
          ) : (
            <>
              <button disabled className="bg-red-500 text-white py-2 px-4 rounded-md mb-2 cursor-not-allowed">
                Occupied
              </button>
              <button className="bg-[var(--color-secondary)] text-white py-1 px-4 rounded-md">
                View More Dates
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default HouseList;
