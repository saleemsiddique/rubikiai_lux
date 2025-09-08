"use client";
import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firestore";

interface House {
  id: string;
  name: string;
  maxGuests: number;
  images: string[];
  pricePerNight?: Record<string, number>;
  isAvailable?: boolean;
  isCapacityOk?: boolean;
  type: string;
  occupiedDates?: Record<string, boolean>;
  description?: string;
}

interface Reservation {
  checkIn: any;
  checkOut: any;
  houseId: string;
}

interface ReservationFormProps {
  onReserve?: (houseId: string, startDate: Date, endDate: Date) => void;
  showResults?: boolean;
}

const DATE_WINDOW_DAYS = 14;

// --- Utilidades únicas ---
function toDateOnly(value: any): Date {
  if (!value) return new Date(0);
  let d: Date;
  if (typeof value?.toDate === "function") d = value.toDate();
  else d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}
function dateIso(d: Date) {
  return d.toISOString().split("T")[0];
}
function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
// comprueba solapamiento entre rango [start, end) y set de fechas ocupadas (ISO strings)
function rangeOverlapsOccupied(start: Date, end: Date, occupiedSet: Set<string>) {
  let cur = new Date(start);
  while (cur < end) {
    if (occupiedSet.has(dateIso(cur))) return true;
    cur = addDays(cur, 1);
  }
  return false;
}

const ReservationForm: React.FC<ReservationFormProps> = ({
  onReserve,
  showResults = true,
}) => {
  const router = useRouter();

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [propertyType, setPropertyType] = useState<
    "todos" | "dupleksas" | "ezero namelis"
  >("todos");
  const [openPicker, setOpenPicker] = useState<"arrival" | "departure" | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [houses, setHouses] = useState<House[]>([]);
  const [openHouseId, setOpenHouseId] = useState<string | null>(null);
  // Map houseId -> Set(YYYY-MM-DD)
  const [occupiedDatesByHouse, setOccupiedDatesByHouse] = useState<
    Record<string, Set<string>>
  >({});
  const [carouselOffsetByHouse, setCarouselOffsetByHouse] = useState<
    Record<string, number>
  >({});

  const onChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
    if (start && !end) setOpenPicker("departure");
    else setOpenPicker(null);
    // recalcular disponibilidad global al cambiar por el datepicker
    setTimeout(() => recomputeHousesAvailability(start, end), 0);
  };

  const handleGuestsChange = (inc: number) =>
    setGuests((p) => Math.max(1, p + inc));

  const searchHouses = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reservations/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          guests,
          propertyType,
        }),
      });
      const data = await res.json();
      const results = (data.results || []) as House[];
      setHouses(results);
      // populate occupiedDatesByHouse from API results
      const newMap: Record<string, Set<string>> = {};
      results.forEach((h) => {
        if (h.occupiedDates) newMap[h.id] = new Set(Object.keys(h.occupiedDates));
      });
      setOccupiedDatesByHouse((prev) => ({ ...prev, ...newMap }));
      // recompute availability based on current selected dates
      recomputeHousesAvailability(startDate, endDate, results, { ...occupiedDatesByHouse, ...newMap });
    } catch (err) {
      console.error(err);
      setHouses([]);
    } finally {
      setLoading(false);
    }
  };

  // fetchOccupiedDatesForHouse (normaliza timestamps y strings)
  const fetchOccupiedDatesForHouse = async (houseId: string, force = false) => {
    if (occupiedDatesByHouse[houseId] && !force)
      return occupiedDatesByHouse[houseId];

    const q = query(
      collection(db, "reservations"),
      where("houseId", "==", houseId)
    );
    const snapshot = await getDocs(q);
    const s = new Set<string>();

    snapshot.forEach((doc) => {
      const data = doc.data() as Reservation;
      const resStart = toDateOnly(data.checkIn);
      const resEnd = toDateOnly(data.checkOut);
      // marcar desde resStart (incluida) hasta resEnd (excluida)
      let cur = new Date(resStart);
      while (cur < resEnd) {
        s.add(dateIso(cur));
        cur = addDays(cur, 1);
      }
    });

    setOccupiedDatesByHouse((prev) => ({ ...prev, [houseId]: s }));
    return s;
  };

  const toggleOpenHouse = async (houseId: string) => {
    if (openHouseId === houseId) {
      setOpenHouseId(null);
      return;
    }
    setOpenHouseId(houseId);
    setCarouselOffsetByHouse((p) => ({ ...p, [houseId]: p[houseId] ?? 0 }));
    // forzamos recarga para reflejar reservas nuevas
    const setFetched = await fetchOccupiedDatesForHouse(houseId, true);
    // una vez cargadas las ocupadas, recalculamos disponibilidad
    recomputeHousesAvailability(startDate, endDate, houses, { ...occupiedDatesByHouse, [houseId]: setFetched });
  };

  const shiftCarousel = (houseId: string, days: number) => {
    setCarouselOffsetByHouse((p) => {
      const cur = p[houseId] ?? 0;
      return { ...p, [houseId]: cur + days };
    });
  };

  // --- NUEVA LÓGICA: recalcular disponibilidad en cliente ---
  function computeAvailabilityForHouse(
    house: House,
    sDate: Date | null,
    eDate: Date | null,
    occupiedMap: Record<string, Set<string>>
  ) {
    const isCapacityOk = (house.maxGuests ?? 0) >= (guests ?? 0);
    if (!sDate || !eDate) {
      // si no hay rango seleccionado dejamos el isAvailable que venga (o true por defecto)
      return { ...house, isCapacityOk, isAvailable: house.isAvailable ?? true };
    }
    const occupiedSet = occupiedMap[house.id] ?? new Set<string>();
    // tratamos el rango como [startDate, endDate) — noches entre start y end-1
    const overlaps = rangeOverlapsOccupied(sDate, eDate, occupiedSet);
    return { ...house, isCapacityOk, isAvailable: !overlaps };
  }

  // Recalcula las propiedades isAvailable/isCapacityOk de todas las houses y actualiza state
  function recomputeHousesAvailability(
    sDate: Date | null,
    eDate: Date | null,
    housesList?: House[],
    occupiedMapOverride?: Record<string, Set<string>>
  ) {
    const baseHouses = housesList ?? houses;
    const occupiedMap = occupiedMapOverride ?? occupiedDatesByHouse;
    const newHouses = baseHouses.map((h) =>
      computeAvailabilityForHouse(h, sDate, eDate, occupiedMap)
    );
    setHouses(newHouses);
  }

  // helpers de validación
  const isOccupied = (houseId: string, iso: string) => {
    const s = occupiedDatesByHouse[houseId];
    return !!s && s.has(iso);
  };

  const isBefore = (aIso: string, bIso: string) => new Date(aIso) < new Date(bIso);
  const isAfter = (aIso: string, bIso: string) => new Date(aIso) > new Date(bIso);

  // seleccionar arrival
  const handleSelectArrival = (houseId: string, d: Date) => {
    const iso = dateIso(d);
    if (isOccupied(houseId, iso)) return;
    if (endDate) {
      const endIso = dateIso(endDate);
      if (!isBefore(iso, endIso)) return;
    }
    setStartDate(d);
    if (!endDate) setEndDate(addDays(d, 1));
    // recalcular disponibilidad en clientes (inmediato)
    setTimeout(() => recomputeHousesAvailability(addDays(d, 0), endDate), 0);
  };

  // seleccionar departure
  const handleSelectDeparture = (houseId: string, d: Date) => {
    const iso = dateIso(d);
    if (isOccupied(houseId, iso)) return;
    if (startDate) {
      const startIso = dateIso(startDate);
      if (!isAfter(iso, startIso)) return;
    }
    setEndDate(d);
    if (!startDate) setStartDate(addDays(d, -1));
    // recalcular disponibilidad en clientes (inmediato)
    setTimeout(() => recomputeHousesAvailability(startDate, addDays(d, 0)), 0);
  };

  // Render del carousel (igual que antes)
  const renderCarouselForHouse = (house: House, mode: "arrival" | "departure") => {
    const houseId = house.id;
    const offset = carouselOffsetByHouse[houseId] ?? 0;
    const base = startDate ? new Date(startDate) : new Date();
    if (mode === "departure" && endDate) base.setDate(endDate.getDate() + offset);
    else base.setDate(base.getDate() + offset);

    const days: Date[] = Array.from({ length: DATE_WINDOW_DAYS }).map((_, i) =>
      addDays(base, i)
    );
    const occupiedSet = occupiedDatesByHouse[houseId] ?? new Set<string>();

    return (
      <div className="w-full mt-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-2 items-center">
            <button onClick={() => shiftCarousel(houseId, -7)} className="px-2 py-1 border rounded">◀</button>
            <div className="text-sm font-medium">{mode === "arrival" ? "Selecciona llegada" : "Selecciona salida"}</div>
          </div>
          <button onClick={() => shiftCarousel(houseId, 7)} className="px-2 py-1 border rounded">▶</button>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-flex gap-2">
            {days.map((d) => {
              const ds = dateIso(d);
              const occupied = occupiedSet.has(ds);
              let disabled = false;
              if (!isAfter(ds, dateIso(addDays(new Date(), -1)))) disabled = true;
              if (occupied) disabled = true;

              if (mode === "arrival") {
                if (endDate) {
                  const endIso = dateIso(endDate);
                  if (!isBefore(ds, endIso)) disabled = true;
                }
              } else {
                if (startDate) {
                  const startIso = dateIso(startDate);
                  if (!isAfter(ds, startIso)) disabled = true;
                }
              }

              const selectedArrival = startDate && dateIso(startDate) === ds;
              const selectedDeparture = endDate && dateIso(endDate) === ds;
              const inRange = startDate && endDate && dateIso(startDate) <= ds && ds <= dateIso(endDate);

              const classes = [
                "min-w-[84px] p-2 rounded-md text-center border transition-transform transform hover:scale-105",
              ];
              if (occupied) classes.push("bg-red-500 text-white cursor-not-allowed");
              else if (selectedArrival || selectedDeparture) classes.push("bg-[var(--color-primary)] text-white");
              else if (inRange) classes.push("bg-[var(--color-primary)]/20");
              else classes.push("bg-white text-[var(--color-text)]");

              if (disabled && !occupied) classes.push("opacity-60 cursor-not-allowed");

              return (
                <div
                  key={ds}
                  className={classes.join(" ")}
                  onClick={() => {
                    if (occupied || disabled) return;
                    if (mode === "arrival") handleSelectArrival(houseId, d);
                    else handleSelectDeparture(houseId, d);
                  }}
                >
                  <div className="text-sm font-bold">{d.getDate()}/{d.getMonth() + 1}</div>
                  <div className="text-xs">{d.toLocaleString(undefined, { weekday: "short" })}</div>
                  <div className="text-xs mt-1">{occupied ? "Ocupado" : mode === "arrival" ? "Llega" : "Sale"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render principal (idéntico visualmente a tu versión original)
  return (
    <div className="card-soft mt-12 p-6 md:p-8 flex flex-col items-center relative z-10 w-full">
      {/* Property Type Toggle */}
      <div className="flex justify-center space-x-4 mb-4 z-10 relative">
        {["todos", "dupleksas", "ezero namelis"].map((type) => (
          <button
            key={type}
            onClick={() => setPropertyType(type as any)}
            className={`px-6 py-2 rounded-full font-sans uppercase text-sm font-bold tracking-wide transition-colors ${
              propertyType === type
                ? "bg-[var(--color-primary)] text-white"
                : "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] hover:text-white"
            }`}
          >
            {type === "todos" ? "Todos" : type === "dupleksas" ? "Dupleksas" : "Ezero Namelis"}
          </button>
        ))}
      </div>

      {/* Dates & Guests */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full justify-center items-center mb-4">
        {/* Arrival DatePicker display */}
        <div className="flex flex-col text-left flex-1 border-r border-[var(--color-primary)] pr-4 w-full">
          <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Arrival</label>
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
            customInput={<div className="p-2 bg-transparent text-[var(--color-text)] font-sans text-xl cursor-pointer">{startDate ? startDate.toLocaleDateString("en-US",{ day: "2-digit", month: "2-digit" }) : "MM/DD"}</div>}
          />
        </div>

        {/* Departure DatePicker display */}
        <div className="flex flex-col text-left flex-1 border-r border-[var(--color-primary)] pr-4 w-full">
          <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Departure</label>
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
            customInput={<div className="p-2 bg-transparent text-[var(--color-text)] font-sans text-xl cursor-pointer">{endDate ? endDate.toLocaleDateString("en-US",{ day: "2-digit", month: "2-digit" }) : "MM/DD"}</div>}
          />
        </div>

        {/* Guests */}
        <div className="flex flex-col text-left flex-1 w-full">
          <label className="text-[var(--color-primary-dark)] text-sm mb-1 font-sans uppercase">Guests</label>
          <div className="flex items-center justify-center p-2 bg-transparent text-[var(--color-text)] font-sans text-xl">
            <button onClick={() => handleGuestsChange(-1)} className="px-2 text-3xl leading-none text-[var(--color-text)] hover:text-[var(--color-primary-dark)]">-</button>
            <div className="w-12 text-center">{guests}</div>
            <button onClick={() => handleGuestsChange(1)} className="px-2 text-3xl leading-none text-[var(--color-text)] hover:text-[var(--color-primary-dark)]">+</button>
          </div>
        </div>
      </div>

      {/* Search Button */}
      <button onClick={searchHouses} className="bg-[var(--color-secondary)] hover:bg-[var(--color-primary-dark)] text-[var(--color-background-main)] font-bold py-3 px-8 rounded-md transition-colors w-full md:w-auto mt-2 md:mt-0 font-sans">
        {loading ? "Searching..." : "Check Availability"}
      </button>

      {/* Results */}
      {showResults && houses.length > 0 && (
        <div className="mt-6 w-full flex flex-col gap-4">
          {houses.map((house) => (
            <div key={house.id} className="w-full">
              <div className="flex border border-[var(--color-primary)] rounded-md overflow-hidden h-36 relative">
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-[var(--color-primary-dark)]">{house.name}</h3>
                    <p className="text-sm text-[var(--color-text)]">Max Guests: {house.maxGuests}</p>
                    <p className="text-xs text-[var(--color-text)] mt-1">{house.description}</p>
                  </div>
                </div>

                <div className="flex flex-col w-32">
                  <button
                    className={`flex-1 ${house.isAvailable && house.isCapacityOk ? "bg-[var(--color-primary)]" : "bg-red-500"} text-white py-2 px-2 text-sm`}
                    onClick={() => startDate && endDate && house.isAvailable && house.isCapacityOk && onReserve?.(house.id, startDate, endDate)}
                    disabled={!house.isAvailable || !house.isCapacityOk}
                  >
                    {house.isAvailable && house.isCapacityOk ? "Disponible" : "Ocupado"}
                  </button>

                  <button className="flex-[0.7] bg-[var(--color-secondary)] text-white py-1 px-2 text-sm" onClick={() => toggleOpenHouse(house.id)}>
                    {openHouseId === house.id ? "Cerrar fechas" : "Ver más fechas"}
                  </button>
                </div>
              </div>

              {/* Expandable panel */}
              <div className={`overflow-hidden transition-all duration-150 ease-out ${openHouseId === house.id ? "max-h-[1200px] mt-2" : "max-h-0"}`}>
                <div className="p-4 border border-t-0 border-[var(--color-primary)] rounded-b-md bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold">Fechas ocupadas para {house.name}</div>
                    <div className="text-sm">(selecciona llegada y salida)</div>
                  </div>

                  {!occupiedDatesByHouse[house.id] ? (
                    <div className="py-4 text-center">Cargando fechas...</div>
                  ) : (
                    <>
                      {renderCarouselForHouse(house, "arrival")}
                      {renderCarouselForHouse(house, "departure")}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReservationForm;
