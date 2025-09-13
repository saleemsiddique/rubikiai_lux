// ---------- context/HouseContext.tsx ----------
"use client";
import React, { createContext, useContext, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firestore";

export type HouseFromDb = {
  id: string;
  alias?: string;
  name?: string;
  maxGuests?: number;
  images?: string[];
  description?: string;
  type?: string;
  pricePerNight?: Record<string, number>;
  occupiedDates?: Record<string, boolean>;
};

type HouseContextType = {
  getHouse: (id: string) => Promise<HouseFromDb | null>;
  prefetchHouses: (ids: string[]) => Promise<void>;
};

const HouseContext = createContext<HouseContextType | undefined>(undefined);

export const HouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // cache lives inside provider and persists while the app is mounted
  const cacheRef = useRef<Map<string, HouseFromDb | null>>(new Map());

  const getHouse = async (id: string) => {
    const cache = cacheRef.current;
    if (cache.has(id)) return cache.get(id) ?? null;
    try {
      const ref = doc(db, "houses", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        cache.set(id, null);
        return null;
      }
      const data = snap.data() as any;
      const house: HouseFromDb = { ...(data || {}), id: snap.id };
      cache.set(id, house);
      return house;
    } catch (err) {
      console.error("HouseProvider.getHouse error:", err);
      cacheRef.current.set(id, null);
      return null;
    }
  };

  const prefetchHouses = async (ids: string[]) => {
    const promises = ids.map(async (id) => {
      if (!id) return;
      if (cacheRef.current.has(id)) return;
      await getHouse(id);
    });
    await Promise.all(promises);
  };

  return (
    <HouseContext.Provider value={{ getHouse, prefetchHouses }}>
      {children}
    </HouseContext.Provider>
  );
};

export function useHouseContext() {
  const ctx = useContext(HouseContext);
  if (!ctx) throw new Error("useHouseContext must be used within HouseProvider");
  return ctx;
}

// convenience hook used by components to get house data by id
import { useEffect, useState } from "react";
export function useHouse(houseId?: string) {
  const { getHouse } = useHouseContext();
  const [house, setHouse] = useState<HouseFromDb | null | undefined>(() =>
    houseId ? undefined : null
  ); // undefined = loading when id provided

  useEffect(() => {
    let cancelled = false;
    if (!houseId) {
      setHouse(null);
      return;
    }
    setHouse(undefined);
    (async () => {
      const h = await getHouse(houseId);
      if (!cancelled) setHouse(h);
    })();
    return () => {
      cancelled = true;
    };
  }, [houseId, getHouse]);

  return house; // undefined = loading, null = not found, object = data
}