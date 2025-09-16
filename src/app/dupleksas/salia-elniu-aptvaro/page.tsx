// app/dupleksas/salia-elniu-aptvaro/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import ImageGallery from "@/components/ImageGallery";
import { FaBed, FaUserFriends, FaRulerCombined, FaCheck } from "react-icons/fa";
import OtherOptions from "@/components/OtherOptions";
import { useRouter, useSearchParams } from "next/navigation";
import { HOUSE_ROUTE_OVERRIDES_BY_ID } from "@/lib/houseRoutes"; // mapping centralizado: id -> {path, houseParam}

const images = [
  "/duplex-1/img1.avif",
  "/duplex-1/img2.avif",
  "/duplex-1/img3.avif",
  "/duplex-1/img4.avif",
  "/duplex-1/img5.avif",
  "/duplex-1/img6.avif",
  "/duplex-1/img7.avif",
  "/duplex-1/img8.avif",
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

const ElniuAptvaroPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Query params
  const startParam = searchParams?.get("start") ?? null;
  const endParam = searchParams?.get("end") ?? null;
  const guestsParam = searchParams?.get("guests") ?? "4";
  const typeParam = searchParams?.get("type") ?? "dupleksas";

  // client-side price params (we won't trust these; server is authoritative)
  const totalParam = searchParams?.get("total") ?? null;
  const firstParam = searchParams?.get("first") ?? null;

  const totalFromQuery = totalParam ? parseFloat(totalParam) : null;
  const firstFromQuery = firstParam ? parseFloat(firstParam) : null;

  const startFriendly = formatDateFriendly(startParam);
  const endFriendly = formatDateFriendly(endParam);

  // slug público de esta página (houseParam)
  const houseSlug = "salia-elniu-aptvaro";

  // buscar el houseId real en lib/houseRoutes.ts por houseParam === houseSlug
  // HOUSE_ROUTE_OVERRIDES_BY_ID debe exportarse desde lib/houseRoutes.ts
  const houseIdFromMapping = useMemo(() => {
    try {
      const entries = Object.entries(HOUSE_ROUTE_OVERRIDES_BY_ID || {});
      const found = entries.find(([, v]) => v && v.houseParam === houseSlug);
      return found ? found[0] : undefined;
    } catch {
      return undefined;
    }
  }, [houseSlug]);

  // Parseo seguro de guests como entero (usaremos esto para la request)
  const guestsNum = useMemo(() => {
    const n = parseInt(guestsParam || "4", 10);
    if (Number.isNaN(n) || n < 1) return 1;
    return n;
  }, [guestsParam]);

  // precio obtenido del servidor (server authoritative)
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [totalFromServer, setTotalFromServer] = useState<number | null>(null);
  const [firstFromServer, setFirstFromServer] = useState<number | null>(null);

  const isIsoDateString = (s: string | null) => {
    if (!s) return false;
    const d = new Date(s);
    return !Number.isNaN(d.getTime());
  };

  async function callPriceEndpoint(endpoint: string, body: any) {
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  useEffect(() => {
    // Si no hay mapeo, no intentamos calcular precio
    if (!houseIdFromMapping) {
      setPriceError("House mapping not found. Check lib/houseRoutes.ts for this houseParam.");
      setTotalFromServer(null);
      setFirstFromServer(null);
      return;
    }

    // sólo si start/end válidos
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
        guests: guestsNum, // <-- ahora enviamos un entero seguro
        type: typeParam,
      };

      const endpoints = ["/api/reservations/price", "/api/reservation/price"];
      let lastErr: string | null = null;

      for (const ep of endpoints) {
        try {
          const res = await callPriceEndpoint(ep, body);
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            lastErr = `Endpoint ${ep} returned ${res.status}: ${text.substring(0, 300)}`;
            // si es 404, intentamos el siguiente candidato; si no, lo mostramos
            if (res.status === 404) continue;
            throw new Error(lastErr);
          }

          const data = await res.json().catch((e) => {
            throw new Error(`Invalid JSON from ${ep}: ${String(e)}`);
          });

          // esperamos { total: number|null, first: number|null }
          const total = typeof data.total === "number" ? data.total : null;
          const first = typeof data.first === "number" ? data.first : null;

          if (mounted) {
            setTotalFromServer(total);
            setFirstFromServer(first);
            setPriceError(null);
            setLoadingPrice(false);
          }
          return;
        } catch (err: any) {
          lastErr = err?.message ?? String(err);
          // intenta siguiente endpoint
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
  }, [startParam, endParam, guestsNum, typeParam, houseIdFromMapping]); // dependemos de guestsNum ahora

  const handleReserveNow = () => {
    if (!startParam || !endParam) {
      router.push("/reservations");
      return;
    }

    let q = `start=${encodeURIComponent(startParam)}&end=${encodeURIComponent(endParam)}&guests=${encodeURIComponent(
      String(guestsNum)
    )}&type=${encodeURIComponent(typeParam)}&house=${encodeURIComponent(houseSlug)}`;

    // No usamos los precios de la query para mostrarlos — el servidor manda el precio.
    // Permitimos pasarlos si quieres reenviarlos, pero advertimos en comentarios que el servidor es autoritativo.
    if (totalFromQuery !== null) q += `&total=${encodeURIComponent(String(totalFromQuery))}`;
    if (firstFromQuery !== null) q += `&first=${encodeURIComponent(String(firstFromQuery))}`;

    router.push(`/reservations?${q}`);
  };

  return (
    <main className="bg-gray-100 text-[var(--color-text)]">
      {/* Hero */}
      <div className="relative h-screen">
        <Image src="/dupleksas1.png" alt="Šalia Elnių Aptvaro Duplex" fill style={{ objectFit: "cover" }} className="absolute inset-0 z-0" />
        <div className="absolute inset-0 bg-black opacity-40 z-10" />
        <div className="relative z-20 flex flex-col items-start justify-end h-full p-8 text-white">
          <h1 className="text-4xl md:text-6xl font-extrabold font-header">N°1 - Šalia Elnių Aptvaro</h1>
          <p className="text-lg md:text-xl font-light font-sans mt-2">Experience magical moments by the Rubikiai lake.</p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-sans">
            <span className="flex items-center"><FaUserFriends className="mr-2" /> Accommodates: 4</span>
            <span className="flex items-center"><FaRulerCombined className="mr-2" /> Size: 40 sq m</span>
            <span className="flex items-center"><FaBed className="mr-2" /> Beds: 2 Singles, 1 Double</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <h2 className="text-3xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">About this place</h2>
              <p className="mb-4 font-sans leading-relaxed">
                Relax by Rubikiai lake, surrounded by deer, fallow deer, and wild nature! This bright, classic-Scandinavian style duplex is located on a 7-hectare homestead, just 100m from the Rubikiai lake. The homestead is in a completely secluded location with a private access road.
              </p>
              <p className="mb-4 font-sans leading-relaxed">
                The duplex is unique because it borders a 2-hectare deer and fallow deer territory (only a transparent fence separates you). The house consists of two 40m² apartments, with separate entrances, separate terraces, and private hot tubs (Jacuzzi).
              </p>
              <p className="font-sans leading-relaxed">
                In the apartments, you will find everything you may need: a fully equipped kitchen, a relaxation area, a bathroom, a bedroom (2 single and 1 double beds), WiFi... Heated floors for your comfort, a heat pump for warm evenings, a stove for a romantic cozy feel, and air conditioning to cool down in the hot summer. During the warm season, you can also enjoy the nearby large private beach. We offer rental of a water bike, boat, or canoe with which you can explore and get to know even 16 islands of the Rubikiai lake or watch the most wonderful red sunsets.
              </p>
            </div>

            <div className="lg:col-span-1">
              <div className="card-soft p-6">
                <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary)]">Reservation</h3>

                <div className="space-y-4 font-sans mb-4">
                  <div>
                    <h4 className="font-bold">Check-in:</h4>
                    {startFriendly ? <p className="text-lg">{startFriendly} — 04:00 PM</p> : <p className="text-lg">04:00 PM</p>}
                  </div>
                  <div>
                    <h4 className="font-bold">Check-out:</h4>
                    {endFriendly ? <p className="text-lg">{endFriendly} — 11:00 AM</p> : <p className="text-lg">11:00 AM</p>}
                  </div>
                </div>

                {/* Mostrar el bloque de pago sólo si hay fechas válidas */}
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
                  className={`mt-4 ${!startParam || !endParam ? "opacity-60 cursor-not-allowed" : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]"} text-white font-bold py-3 px-8 rounded-md transition-colors w-full text-center font-sans block`}
                >
                  {startParam && endParam ? "Reserve now" : "Select dates to reserve"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Amenities & Addons */}
      <section className="bg-white py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            <div>
              <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">Amenities</h3>
              <ul className="space-y-2 font-sans">
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> A/C</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> WiFi</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> TV</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Shower</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Kitchen</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Towels</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Jacuzzi</li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">Addons</h3>
              <p className="text-gray-600 mb-2 font-sans">These services can be added to your reservation for an additional fee.</p>
              <ul className="space-y-2 font-sans">
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Water bike rental</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Boat rental</li>
                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Canoe rental</li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">Special features</h3>
              <div className="flex items-center mb-2 font-sans">
                <FaCheck className="text-green-500 mr-2" />
                <span>Romantic fireplace for cozy evenings.</span>
              </div>
              <p className="text-gray-600 mb-4 font-sans">Perfect for a cozy, intimate evening. Firewood is provided.</p>
            </div>
          </div>
        </div>
      </section>

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

export default ElniuAptvaroPage;
