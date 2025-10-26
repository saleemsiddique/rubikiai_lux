"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface PriceResponse {
  total: number | null;        // alojamiento + extraGuests per night, sin jacuzzi
  first: number | null;        // primer cargo estimado (sin jacuzzi)
  nights: number;
  extraGuests: number;
  includedBase: number;
  jacuzziFee: number;          // suplemento jacuzzi calculado por el backend
  extrasTotal: number;         // ahora mismo == jacuzziFee o 0
  grandTotal: number;          // total final con jacuzzi
  variable: boolean;
  perNightBreakdown: Array<{
    date: string;
    perUnit: Array<{ id: string; price: number | null }>;
    nightTotal: number;
  }>;
}

export default function CheckoutDetailsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Params que vienen del paso anterior
  const houseId = searchParams.get("houseId") || ""; // puede ser single o "a__b"
  const houseSlug = searchParams.get("houseSlug") || "";
  const startIso = searchParams.get("start") || "";  // toISOString() original
  const endIso = searchParams.get("end") || "";
  const guestsParam = searchParams.get("guests") || "2";
  const guests = Number(guestsParam) || 2;

  // Estado de jacuzzi (checkbox de la UI)
  const [withJacuzzi, setWithJacuzzi] = useState(false);

  // Estado de pricing que viene del backend
  const [priceData, setPriceData] = useState<PriceResponse | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);

  // Datos del cliente
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [email2, setEmail2]       = useState("");
  const [phone, setPhone]         = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [comment, setComment]         = useState("");

  // validaciones
  const emailsMatch = email.trim() !== "" && email === email2;

  const canSubmit =
    !loadingPrice &&
    !priceError &&
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    emailsMatch &&
    phone.trim() !== "" &&
    priceData !== null;

  // Precio que mostramos al usuario:
  // - Si "withJacuzzi" está activo, usamos priceData.grandTotal
  // - Si no, usamos priceData.total
  const displayedTotal = useMemo(() => {
    if (!priceData) return null;
    return withJacuzzi ? priceData.grandTotal : priceData.total;
  }, [priceData, withJacuzzi]);

  // ---- Llamar /api/reservations/price cuando cambie jacuzzi o params ----
  useEffect(() => {
    const fetchPrice = async () => {
      setLoadingPrice(true);
      setPriceError(null);

      try {
        const res = await fetch("/api/reservations/price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            houseId,
            startDate: startIso,
            endDate: endIso,
            guests,
            jacuzzi: withJacuzzi, // 👈 importante
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error("price error", data);
          setPriceError(data.error || "No se pudo calcular el precio");
          setPriceData(null);
          setLoadingPrice(false);
          return;
        }

        setPriceData(data);
      } catch (err: any) {
        console.error("price network error", err);
        setPriceError("Error de red al calcular el precio");
        setPriceData(null);
      } finally {
        setLoadingPrice(false);
      }
    };

    // solo intentamos si tenemos datos mínimos
    if (houseId && startIso && endIso && guests) {
      fetchPrice();
    } else {
      setLoadingPrice(false);
      setPriceError("Faltan parámetros de la reserva");
    }
  }, [houseId, startIso, endIso, guests, withJacuzzi]);

  // ---- Ir a Stripe ----
  const handleGoToCheckout = async () => {
    if (!canSubmit || !priceData) return;

    try {
      const body = {
        houseId: houseId,
        start: startIso,
        end: endIso,
        guests,
        houseSlug: houseSlug || undefined,

        customer: {
          email,
          name: `${firstName} ${lastName}`.trim(),
          phone,
          arrivalTime: arrivalTime || undefined,
          comment: comment || undefined,
        },

        extras: {
          jacuzzi: withJacuzzi
            ? {
                enabled: true,
                price: priceData.jacuzziFee, // calculado por backend
              }
            : { enabled: false },
        },
      };

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("create-checkout-session failed", data);
        alert(data.error || "Error creando la sesión de pago");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      alert("No checkout URL returned");
    } catch (err) {
      console.error("handleGoToCheckout error:", err);
      alert("Error de red creando la sesión de pago");
    }
  };

  // ---- Render helpers ----
  const nights = priceData?.nights ?? 0;
  const firstNightCharge = priceData?.first ?? null;
  const jacuzziFeeShown = withJacuzzi ? priceData?.jacuzziFee ?? 0 : 0;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 mt-12 md:py-12">
      <h1 className="text-3xl font-extrabold text-[var(--color-primary-dark)] mb-6 leading-tight">
        Información de la Reserva
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna izquierda */}
        <section className="lg:col-span-2 space-y-8">
          {/* Datos personales */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-[var(--color-primary-dark)] mb-4">
              Tus datos
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Apellido
                </label>
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Tu apellido"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@email.com"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Confirmar Email
                </label>
                <input
                  type="email"
                  className={`border rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 ${
                    email2 && !emailsMatch
                      ? "border-red-500 focus:ring-red-400"
                      : "border-gray-300 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  }`}
                  value={email2}
                  onChange={(e) => setEmail2(e.target.value)}
                  placeholder="Repite tu correo"
                />
                {email2 && !emailsMatch && (
                  <span className="text-xs text-red-600 mt-1">
                    Los emails no coinciden
                  </span>
                )}
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+34 ..."
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Hora estimada de llegada
                </label>
                <input
                  type="time"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                />
              </div>
            </div>

            {/* Comentarios */}
            <div className="mt-4 flex flex-col">
              <label className="text-sm font-semibold text-gray-700 mb-1">
                Comentarios adicionales
              </label>
              <textarea
                className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="¿Algo que debamos saber? (allergies, birthday surprise, etc)"
              />
            </div>
          </div>

          {/* Extras */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-[var(--color-primary-dark)] mb-4">
              Extras
            </h2>

            <label className="flex items-start gap-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 rounded border-gray-400 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                checked={withJacuzzi}
                onChange={(e) => setWithJacuzzi(e.target.checked)}
              />
              <div className="flex-1">
                <div className="text-base font-semibold text-gray-900 flex flex-wrap items-baseline gap-2">
                  Jacuzzi privado
                  {priceData && withJacuzzi && (
                    <span className="text-sm font-bold text-[var(--color-primary)]">
                      +{priceData.jacuzziFee}€
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 leading-relaxed">
                  65€ incluye hasta 2 personas. +10€ por cada huésped
                  adicional.
                </div>
              </div>
            </label>
          </div>
        </section>

        {/* Columna derecha: resumen */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-xl p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-[var(--color-primary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Tu estancia
            </h2>

            <div className="text-sm text-gray-700 space-y-2">
              <div className="flex justify-between">
                <span>Check-in:</span>
                <span className="font-medium">
                  {startIso
                    ? new Date(startIso).toLocaleDateString()
                    : "-"}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Check-out:</span>
                <span className="font-medium">
                  {endIso ? new Date(endIso).toLocaleDateString() : "-"}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Noches:</span>
                <span className="font-medium">{nights}</span>
              </div>

              <div className="flex justify-between">
                <span>Huéspedes:</span>
                <span className="font-medium">{guests}</span>
              </div>

              {withJacuzzi && priceData && (
                <div className="flex justify-between text-[var(--color-primary-dark)] font-semibold">
                  <span>Jacuzzi</span>
                  <span>+{jacuzziFeeShown}€</span>
                </div>
              )}

              <hr className="my-4 border-gray-300" />

              <div className="flex justify-between text-base font-bold text-[var(--color-primary-dark)]">
                <span>Total estimado</span>
                <span>
                  {loadingPrice
                    ? "..."
                    : priceError
                    ? "—"
                    : displayedTotal != null
                    ? `${displayedTotal}€`
                    : "Consultar"}
                </span>
              </div>

              {priceError && (
                <p className="text-xs text-red-600 mt-2 italic">
                  {priceError}
                </p>
              )}

              {firstNightCharge !== null && (
                <div className="mt-4 text-xs text-gray-600 leading-relaxed">
                  El pago inicial en el checkout será aprox.{" "}
                  {firstNightCharge}
                  €.
                  <br />
                  El resto (y el jacuzzi si aplica) se termina de
                  formalizar según las condiciones de llegada.
                </div>
              )}
            </div>
          </div>

          <button
            disabled={!canSubmit}
            onClick={handleGoToCheckout}
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide text-sm shadow-lg transition-all duration-300 ${
              canSubmit
                ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] hover:shadow-xl transform hover:-translate-y-0.5"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {canSubmit ? "Pagar ahora" : "Completa los datos"}
          </button>

          <button
            onClick={() => router.back()}
            className="block w-full text-center text-xs text-gray-500 underline hover:text-gray-700"
          >
            Volver
          </button>
        </aside>
      </div>
    </main>
  );
}
