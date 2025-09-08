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
  type: string; // "dupleksas" | "ezero namelis" | ...
  occupiedDates?: Record<string, boolean>; // YYYY-MM-DD -> true (desde la API)
  description?: string;
}

interface Reservation {
  checkIn: string; // "YYYY-MM-DD"
  checkOut: string; // "YYYY-MM-DD"
  houseId: string;
}

interface ReservationFormProps {
  onReserve?: (houseId: string, startDate: Date, endDate: Date) => void;
  showResults?: boolean;
}

const DATE_WINDOW_DAYS = 14;

const dateIso = (d: Date) => d.toISOString().split("T")[0];
const todayIso = () => dateIso(new Date());

const addDays = (d: Date, days: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
};

const ReservationForm: React.FC<ReservationFormProps> = ({ onReserve, showResults = true }) => {
  const router = useRouter();

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [propertyType, setPropertyType] = useState<"todos" | "dupleksas" | "ezero namelis">("todos");
  const [openPicker, setOpenPicker] = useState<"arrival" | "departure" | null>(null);
  const [loading, setLoading] = useState(false);
  const [houses, setHouses] = useState<House[]>([]);
  const [openHouseId, setOpenHouseId] = useState<string | null>(null);
  // Map houseId -> Set(YYYY-MM-DD)
  const [occupiedDatesByHouse, setOccupiedDatesByHouse] = useState<Record<string, Set<string>>>({});
  const [carouselOffsetByHouse, setCarouselOffsetByHouse] = useState<Record<string, number>>({});

  const onChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
    if (start && !end) setOpenPicker("departure");
    else setOpenPicker(null);
  };

  const handleGuestsChange = (inc: number) => setGuests((p) => Math.max(1, p + inc));

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
      // populate occupiedDatesByHouse from API results (so panel ya tiene datos)
      const newMap: Record<string, Set<string>> = {};
      results.forEach((h) => {
        if (h.occupiedDates) {
          newMap[h.id] = new Set(Object.keys(h.occupiedDates));
        }
      });
      setOccupiedDatesByHouse((prev) => ({ ...prev, ...newMap }));
    } catch (err) {
      console.error(err);
      setHouses([]);
    } finally {
      setLoading(false);
    }
  };

  // Cliente: fetch ocupadas si no las tenemos (cuando abrimos panel)
  const fetchOccupiedDatesForHouse = async (houseId: string) => {
    if (occupiedDatesByHouse[houseId]) return occupiedDatesByHouse[houseId];
    const q = query(collection(db, "reservations"), where("houseId", "==", houseId));
    const snapshot = await getDocs(q);
    const s = new Set<string>();
    snapshot.forEach((doc) => {
      const data = doc.data() as Reservation;
      let cur = new Date(data.checkIn);
      const end = new Date(data.checkOut);
      while (cur < end) {
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
    // ensure occupied dates loaded (either from API or fetch)
    const houseFromList = houses.find((h) => h.id === houseId);
    if (houseFromList?.occupiedDates && !occupiedDatesByHouse[houseId]) {
      setOccupiedDatesByHouse((prev) => ({
        ...prev,
        [houseId]: new Set(Object.keys(houseFromList.occupiedDates || {})),
      }));
      return;
    }
    await fetchOccupiedDatesForHouse(houseId);
  };

  const shiftCarousel = (houseId: string, days: number) => {
    setCarouselOffsetByHouse((p) => {
      const cur = p[houseId] ?? 0;
      return { ...p, [houseId]: cur + days };
    });
  };

  // helpers de validación
  const isOccupied = (houseId: string, iso: string) => {
    const s = occupiedDatesByHouse[houseId];
    if (s) return s.has(iso);
    return false;
  };

  const isBefore = (aIso: string, bIso: string) => new Date(aIso) < new Date(bIso);
  const isAfter = (aIso: string, bIso: string) => new Date(aIso) > new Date(bIso);

  // seleccionar arrival
  const handleSelectArrival = (houseId: string, d: Date) => {
    const iso = dateIso(d);
    // bloqueado por ocupado o por ser >= endDate (si existe)
    if (isOccupied(houseId, iso)) return;
    if (endDate) {
      const endIso = dateIso(endDate);
      if (!isBefore(iso, endIso)) {
        // arrival must be strictly before endDate
        return;
      }
    }
    // valid -> set
    setStartDate(d);
    // ensure endDate > startDate: if missing, set to start+1
    if (!endDate) {
      setEndDate(addDays(d, 1));
    }
  };

  // seleccionar departure
  const handleSelectDeparture = (houseId: string, d: Date) => {
    const iso = dateIso(d);
    if (isOccupied(houseId, iso)) return;
    if (startDate) {
      const startIso = dateIso(startDate);
      // departure must be strictly after startDate
      if (!isAfter(iso, startIso)) {
        return;
      }
    }
    setEndDate(d);
    if (!startDate) {
      setStartDate(addDays(d, -1));
    }
  };

  // Render del carousel: tipo 'arrival' o 'departure'
  const renderCarouselForHouse = (house: House, mode: "arrival" | "departure") => {
    const houseId = house.id;
    const offset = carouselOffsetByHouse[houseId] ?? 0;
    const base = startDate ? new Date(startDate) : new Date();
    // for departure carousel, better base on endDate if exists
    if (mode === "departure" && endDate) base.setDate(endDate.getDate() + offset);
    else base.setDate(base.getDate() + offset);

    const days: Date[] = Array.from({ length: DATE_WINDOW_DAYS }).map((_, i) => addDays(base, i));
    const occupiedSet = occupiedDatesByHouse[houseId] ?? new Set<string>();

    return (
      <div className="w-full mt-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-2 items-center">
            <button onClick={() => shiftCarousel(houseId, -7)} className="px-2 py-1 border rounded">
              ◀
            </button>
            <div className="text-sm font-medium">
              {mode === "arrival" ? "Selecciona llegada" : "Selecciona salida"}
            </div>
          </div>
          <button onClick={() => shiftCarousel(houseId, 7)} className="px-2 py-1 border rounded">
            ▶
          </button>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-flex gap-2">
            {days.map((d) => {
              const ds = dateIso(d);
              const occupied = occupiedSet.has(ds);
              // disabled rules:
              let disabled = false;
              // no permitir fechas anteriores a hoy
              if (!isAfter(ds, dateIso(addDays(new Date(), -1)))) disabled = true; // ds <= yesterday => disabled
              if (occupied) disabled = true;

              if (mode === "arrival") {
                // arrival cannot be >= endDate (must be strictly before)
                if (endDate) {
                  const endIso = dateIso(endDate);
                  if (!isBefore(ds, endIso)) disabled = true;
                }
                // also if there's a reservation that starts on that day we've already covered with occupied
              } else {
                // departure mode: cannot be <= startDate (must be strictly after)
                if (startDate) {
                  const startIso = dateIso(startDate);
                  if (!isAfter(ds, startIso)) disabled = true;
                }
              }

              // visual selected
              const selectedArrival = startDate && dateIso(startDate) === ds;
              const selectedDeparture = endDate && dateIso(endDate) === ds;
              const inRange =
                startDate && endDate && dateIso(startDate) <= ds && ds <= dateIso(endDate);

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
                  <div className="text-sm font-bold">
                    {d.getDate()}/{d.getMonth() + 1}
                  </div>
                  <div className="text-xs">{d.toLocaleString(undefined, { weekday: "short" })}</div>
                  <div className="text-xs mt-1">
                    {occupied ? "Ocupado" : mode === "arrival" ? "Llega" : "Sale"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

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
                  ? startDate.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })
                  : "MM/DD"}
              </div>
            }
          />
        </div>

        {/* Departure DatePicker display */}
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
                  ? endDate.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })
                  : "MM/DD"}
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

      {/* Search Button */}
      <button
        onClick={searchHouses}
        className="bg-[var(--color-secondary)] hover:bg-[var(--color-primary-dark)] text-[var(--color-background-main)] font-bold py-3 px-8 rounded-md transition-colors w-full md:w-auto mt-2 md:mt-0 font-sans"
      >
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
                    className={`flex-1 ${
                      house.isAvailable && house.isCapacityOk ? "bg-[var(--color-primary)]" : "bg-red-500"
                    } text-white py-2 px-2 text-sm`}
                    onClick={() =>
                      startDate &&
                      endDate &&
                      house.isAvailable &&
                      house.isCapacityOk &&
                      onReserve?.(house.id, startDate, endDate)
                    }
                    disabled={!house.isAvailable || !house.isCapacityOk}
                  >
                    {house.isAvailable && house.isCapacityOk ? "Disponible" : "Ocupado"}
                  </button>

                  <button
                    className="flex-[0.7] bg-[var(--color-secondary)] text-white py-1 px-2 text-sm"
                    onClick={() => toggleOpenHouse(house.id)}
                  >
                    {openHouseId === house.id ? "Cerrar fechas" : "Ver más fechas"}
                  </button>
                </div>
              </div>

              {/* Expandable panel debajo */}
              <div
                className={`overflow-hidden transition-all duration-150 ease-out ${
                  openHouseId === house.id ? "max-h-[1200px] mt-2" : "max-h-0"
                }`}
              >
                <div className="p-4 border border-t-0 border-[var(--color-primary)] rounded-b-md bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold">Fechas ocupadas para {house.name}</div>
                    <div className="text-sm">(selecciona llegada y salida)</div>
                  </div>

                  {!occupiedDatesByHouse[house.id] ? (
                    <div className="py-4 text-center">Cargando fechas...</div>
                  ) : (
                    <>
                      {/* Arrival carousel */}
                      {renderCarouselForHouse(house, "arrival")}
                      {/* Departure carousel */}
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
