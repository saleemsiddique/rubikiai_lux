// app/ezero-namelis/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import ImageGallery from "@/components/ImageGallery";
import OtherOptions from "@/components/OtherOptions";
import { FaBed, FaUserFriends, FaRulerCombined, FaCheck } from "react-icons/fa";
import { useRouter, useSearchParams } from "next/navigation";
import { HOUSE_ROUTE_OVERRIDES_BY_ID } from "@/lib/houseRoutes"; // mapping centralizado

const images = [
  "/lake-house/img1.avif",
  "/lake-house/img2.avif",
  "/lake-house/img3.avif",
  "/lake-house/img4.avif",
  "/lake-house/img5.avif",
  "/lake-house/img6.avif",
  "/lake-house/img7.avif",
  "/lake-house/img8.avif",
];

const formatDateFriendly = (iso?: string | null) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return null;
  }
};

const formatCurrency = (n?: number | null) => {
  if (n == null || Number.isNaN(n)) return null;
  return `${Number(n).toFixed(0)}€`;
};

const EzeroNamelisPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Query params
  const startParam = searchParams?.get("start") ?? null;
  const endParam = searchParams?.get("end") ?? null;
  const guestsParam = searchParams?.get("guests") ?? "2";
  const typeParam = searchParams?.get("type") ?? "ezero namelis";

  const startFriendly = formatDateFriendly(startParam);
  const endFriendly = formatDateFriendly(endParam);

  // slug público
  const houseSlug = "lake-house";

  // obtener houseId real desde mapping centralizado (lib/houseRoutes.ts)
  const houseIdFromMapping = React.useMemo(() => {
    try {
      const entries = Object.entries(HOUSE_ROUTE_OVERRIDES_BY_ID || {});
      const found = entries.find(([, v]) => v && v.houseParam === houseSlug);
      return found ? found[0] : undefined;
    } catch {
      return undefined;
    }
  }, [houseSlug]);

  // price state
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [totalFromServer, setTotalFromServer] = useState<number | null>(null);
  const [firstFromServer, setFirstFromServer] = useState<number | null>(null);

  const isIsoDateString = (s: string | null) => {
    if (!s) return false;
    const d = new Date(s);
    return !Number.isNaN(d.getTime());
  };

  // Try candidate endpoints in order (plural then singular) to be robust against naming
  async function callPriceEndpoint(endpoint: string, body: any) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res;
  }

  useEffect(() => {
    // If mapping not present -> show message and skip
    if (!houseIdFromMapping) {
      setPriceError("House mapping not found. Ensure lib/houseRoutes.ts exports the mapping with this houseParam.");
      setTotalFromServer(null);
      setFirstFromServer(null);
      return;
    }

    // Need valid ISO dates
    if (!isIsoDateString(startParam) || !isIsoDateString(endParam)) {
      setTotalFromServer(null);
      setFirstFromServer(null);
      setPriceError(null);
      return;
    }

    let mounted = true;
    const doFetch = async () => {
      setLoadingPrice(true);
      setPriceError(null);
      setTotalFromServer(null);
      setFirstFromServer(null);

      const body = {
        houseId: houseIdFromMapping,
        startDate: startParam,
        endDate: endParam,
        guests: parseInt(guestsParam || "2", 10),
        type: typeParam,
      };

      // candidate endpoints (try plural first because other parts of app use /api/reservations/...)
      const endpoints = ["/api/reservations/price", "/api/reservation/price"];

      let lastErr: string | null = null;
      for (const ep of endpoints) {
        try {
          const res = await callPriceEndpoint(ep, body);
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            lastErr = `Endpoint ${ep} returned ${res.status}: ${text.substring(0, 200)}`;
            if (res.status === 404) {
              // try next candidate endpoint
              continue;
            } else {
              throw new Error(lastErr);
            }
          }

          const data = await res.json().catch((e) => {
            throw new Error(`Invalid JSON from ${ep}: ${String(e)}`);
          });

          const total = typeof data.total === "number" ? data.total : null;
          const first = typeof data.first === "number" ? data.first : null;

          if (mounted) {
            setTotalFromServer(total);
            setFirstFromServer(first);
            setPriceError(null);
          }
          setLoadingPrice(false);
          return; // success
        } catch (err: any) {
          lastErr = err?.message ?? String(err);
          // continue to next endpoint if any
        }
      }

      if (mounted) {
        setPriceError(lastErr ?? "Could not fetch price");
        setTotalFromServer(null);
        setFirstFromServer(null);
        setLoadingPrice(false);
      }
    };

    doFetch();

    return () => {
      mounted = false;
    };
  }, [startParam, endParam, guestsParam, typeParam, houseIdFromMapping]);

  const handleReserveNow = () => {
    if (!startParam || !endParam) {
      router.push("/reservations");
      return;
    }

    const q = `start=${encodeURIComponent(startParam)}&end=${encodeURIComponent(endParam)}&guests=${encodeURIComponent(
      guestsParam
    )}&type=${encodeURIComponent(typeParam)}&house=${encodeURIComponent(houseSlug)}`;

    router.push(`/reservations?${q}`);
  };

  return (
    <main className="bg-gray-100 text-[var(--color-text)]">
      {/* Hero Section */}
      <div className="relative h-screen">
        <Image src="/lake-house1.png" alt="Ežero Namelis - Lake House" fill style={{ objectFit: "cover" }} className="absolute inset-0 z-0" />
        <div className="absolute inset-0 bg-black opacity-40 z-10"></div>
        <div className="relative z-20 flex flex-col items-start justify-end h-full p-8 text-white">
          <h1 className="text-4xl md:text-6xl font-extrabold font-header">EŽERO NAMELIS</h1>
          <p className="text-lg md:text-xl font-light font-sans mt-2">A private and romantic cottage for two.</p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-sans">
            <span className="flex items-center">
              <FaUserFriends className="mr-2" /> Accommodates: 2
            </span>
            <span className="flex items-center">
              <FaRulerCombined className="mr-2" /> Size: Not specified
            </span>
            <span className="flex items-center">
              <FaBed className="mr-2" /> Beds: 1 Double
            </span>
          </div>
        </div>
      </div>

      {/* Information Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <h2 className="text-3xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">About this place</h2>
              <p className="mb-4 font-sans leading-relaxed">
                A private and romantic cottage right by the lake for two, just 10 steps away from the lake and forest. This bright, classic-retro style apartment offers a luxurious hot tub on the terrace with views of Rubikiai lake. With a private shoreline, beach, and unique sunsets, time seems to stop here.
              </p>
              <p className="font-sans leading-relaxed">
                The apartment has everything you need: a fully equipped kitchen, a living area, a bathroom, a bedroom with a comfortable and spacious double bed, Wi-Fi, TV, and a Kamado Picnic BBQ on the terrace. Enjoy heated floors for comfort, a heat pump for warm evenings, and air conditioning to cool down in the hot summer. During the summer season, you can also enjoy the nearby large private beach. We offer kayaks, water bikes, or boats for rent to explore the 16 islands of Rubikiai lake or watch the most wonderful red sunsets.
              </p>
            </div>

            <div className="lg:col-span-1">
              <div className="card-soft p-6">
                <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary)]">Reservation</h3>
                <div className="space-y-4 font-sans mb-6">
                  <div>
                    <h4 className="font-bold">Check-in:</h4>
                    {startFriendly ? <p className="text-lg">{startFriendly} — 04:00 PM</p> : <p className="text-lg">04:00 PM</p>}
                  </div>
                  <div>
                    <h4 className="font-bold">Check-out:</h4>
                    {endFriendly ? <p className="text-lg">{endFriendly} — 11:00 AM</p> : <p className="text-lg">11:00 AM</p>}
                  </div>
                </div>

                {/* ONLY render payment summary if both start and end params exist */}
                {startParam && endParam && (
                  <div className="mt-3 p-4 rounded-md border bg-white">
                    <div className="text-sm font-medium text-gray-700">Payment summary</div>

                    {loadingPrice ? (
                      <div className="mt-2 text-sm text-gray-600">Calculating price…</div>
                    ) : priceError ? (
                      <div className="mt-2 text-sm text-red-600">Could not calculate price: {priceError}</div>
                    ) : totalFromServer !== null ? (
                      <div className="mt-2">
                        <div className="text-xs text-gray-500">Total for the stay</div>
                        <div className="text-lg font-semibold">{formatCurrency(totalFromServer)}</div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-gray-600">
                        Total price: <span className="font-medium">Price will be shown on selection</span>
                      </div>
                    )}

                    <div className="mt-3 p-3 rounded-md bg-[var(--color-primary)]/10 border-l-4 border-[var(--color-primary)]">
                      <div className="text-xs text-gray-600">Now to charge</div>
                      {firstFromServer !== null ? (
                        <div className="text-2xl font-bold text-[var(--color-primary)-dark]">{formatCurrency(firstFromServer)}</div>
                      ) : (
                        <div className="text-sm font-semibold text-gray-800">First night (price shown at checkout)</div>
                      )}
                      <div className="mt-2 text-xs text-gray-600">The remaining amount will be charged on arrival.</div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleReserveNow}
                  disabled={!startParam || !endParam}
                  className={`mt-4 ${!startParam || !endParam ? "hidden opacity-60 cursor-not-allowed" : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]"} text-white font-bold py-3 px-8 rounded-md transition-colors w-full text-center font-sans block`}
                >
                  {startParam && endParam ? "Reserve now" : "Select dates to reserve"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Amenities Section */}
      <section className="bg-white py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            <div>
              <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">Kitchen</h3>
              <ul className="space-y-2 font-sans">
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Refrigerator</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Microwave</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Electric stove</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Oven</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Coffee machine</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Electric kettle</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Dishes and cutlery</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">Bathroom</h3>
              <ul className="space-y-2 font-sans">
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Bathtub</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Shower</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Toilet</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Electric towel dryer</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Towels</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Hair dryer</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Shampoo, shower gel</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">Features</h3>
              <ul className="space-y-2 font-sans">
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Wi-Fi</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> TV</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Heat pump</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Air conditioning</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Heated floors</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Terrace</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Lake & forest view</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Outdoor furniture</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Luxury jacuzzi</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Kamado BBQ</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery, Map, OtherOptions */}
      <ImageGallery images={images} />

      <section className="py-12 bg-white px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">Location</h2>
          <p className="text-gray-600 mb-6 font-sans">Find us on Google Maps to plan your trip.</p>
          <div className="relative w-full h-96 rounded-lg overflow-hidden shadow-lg">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d157835.4326558231!2d25.43715878297757!3d55.45785055042656!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x46e72c8f8d228c21%3A0x633d7c5b61a4c905!2sRubikiai%20lake!5e0!3m2!1sen!2ses!4v1698716301138!5m2!1sen!2ses"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              aria-label="Location of Rubikiai lake on Google Maps"
            />
          </div>
        </div>
      </section>

      <OtherOptions />
    </main>
  );
};

export default EzeroNamelisPage;
