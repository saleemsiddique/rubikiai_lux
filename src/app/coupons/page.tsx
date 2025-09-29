"use client";
import React, { JSX, useState } from "react";

const AMOUNTS = [100, 150, 200, 300] as const;

export default function CouponPage(): JSX.Element {
  const [selected, setSelected] = useState<number>(AMOUNTS[0]);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const handleBuy = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/coupons/create-checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unitAmount: selected, quantity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No pudimos iniciar el checkout");
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      throw new Error("Respuesta inesperada del servidor");
    } catch (e: any) {
      console.error(e);
      if (typeof window !== "undefined" && window.alert) {
        window.alert(e?.message || "No se pudo iniciar el pago");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-24 px-4 md:px-8" style={{ '--color-primary': '#bfa58b', '--color-primary-dark': '#8f6e52', '--color-secondary': '#7b8ed6', '--color-background-main': '#f4efe9', '--color-background-soft': '#fafafa', '--color-text': '#0f172a', '--color-highlight': '#214235' } as React.CSSProperties}>
      <div className="w-full max-w-6xl">
        <header className="flex items-center justify-start gap-4 p-4 border-b border-[var(--color-primary-dark)]/20">
          <div>
            <h1 className="text-3xl font-extrabold text-[var(--color-highlight)]">Cupones Rubikiai Lux</h1>
            <p className="text-md text-[var(--color-text)]/80">Regala una escapada inolvidable</p>
          </div>
        </header>
      </div>

      <main className="w-full max-w-6xl mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 bg-[var(--color-background-soft)] rounded-2xl p-6 shadow-xl border border-[var(--color-primary)]/40">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-3xl font-bold text-[var(--color-primary-dark)]">Regala Experiencias</h2>
              <p className="text-base mt-2 text-[var(--color-text)]/70">Selecciona el importe y la cantidad del cupón que deseas regalar. Esta página es únicamente un diseño estético (mockup).</p>
            </div>

            <div className="mt-4">
              <h3 className="text-xl font-semibold mb-4 border-b-2 border-[var(--color-secondary)]/50 pb-2 inline-block">Selecciona el Importe</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {AMOUNTS.map((amt) => {
                  const active = selected === amt;
                  return (
                    <button
                      key={amt}
                      onClick={() => setSelected(amt)}
                      className={`relative flex flex-col items-center justify-center p-5 rounded-xl shadow-lg transform hover:-translate-y-1 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-secondary)]/50`}
                      style={{
                        background: active
                          ? 'linear-gradient(180deg, var(--color-primary), var(--color-primary-dark))'
                          : 'var(--color-background-soft)',
                        color: active ? 'var(--color-background-soft)' : 'var(--color-text)',
                        border: active ? `2px solid var(--color-secondary)` : '1px solid var(--color-primary)'
                      }}
                    >
                      <span className="text-sm uppercase tracking-wider font-medium opacity-80">Cupón</span>
                      <span className="mt-1 text-3xl font-black">{amt}€</span>
                      <span className="text-xs mt-1 opacity-70">En alojamiento</span>
                      {active && (
                        <span className="absolute -top-3 right-3 text-xs px-3 py-1 rounded-full font-bold shadow-md" style={{ background: 'var(--color-secondary)', color: 'white' }}>
                          Seleccionado
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-end sm:gap-6 gap-4 border-t pt-6 border-[var(--color-primary)]/20">
              <div className="flex items-center gap-3">
                <label className="text-base font-medium text-[var(--color-text)]">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))}
                  className="w-24 p-2 rounded-lg border-2 border-[var(--color-primary)] bg-white text-base text-center focus:border-[var(--color-secondary)] focus:ring-0 transition"
                />
              </div>
              <div className="flex-1" />
              <div className="flex items-end">
                <button
                  onClick={handleBuy}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl font-bold text-lg shadow-lg hover:scale-[1.03] disabled:opacity-50 disabled:cursor-not-allowed transition-transform duration-200"
                  style={{ background: 'var(--color-secondary)', color: 'white' }}
                >
                  {loading ? 'Redirigiendo…' : `Comprar Ahora (${quantity} x ${selected}€)`}
                </button>
              </div>
            </div>

            <div className="mt-4 text-lg text-[var(--color-text)]">
              <strong className="font-semibold">Total a pagar:</strong> <span className="font-black text-2xl text-[var(--color-primary-dark)]">{(selected * quantity).toFixed(2)} €</span>
            </div>
          </div>
        </section>

        <aside className="bg-[var(--color-background-soft)] rounded-2xl p-6 shadow-xl flex flex-col gap-6 border border-[var(--color-secondary)]/40 h-fit sticky top-12">
          <h3 className="text-xl font-semibold border-b border-[var(--color-primary)]/50 pb-2">Vista Previa</h3>
          <div className="rounded-xl overflow-hidden relative shadow-lg">
            <div className="p-6" style={{ background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))' }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm uppercase tracking-wider text-[var(--color-background-soft)]/90">Cupón Regalo</div>
                  <div className="text-4xl font-black mt-2 text-white">{selected}€</div>
                  <div className="text-sm text-[var(--color-background-soft)]/70 mt-1">Canjeable en alojamiento</div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-[var(--color-background-soft)] text-[var(--color-text)]/70 border-t border-[var(--color-primary)]/20">
              <div className="text-sm font-medium">Válido 12 meses desde la compra</div>
              <div className="text-xs mt-1">No reembolsable. Sujeto a disponibilidad de la propiedad.</div>
            </div>
          </div>
          <div className="mt-2">
            <h4 className="text-base font-semibold text-[var(--color-highlight)]">Información Clave</h4>
            <ul className="text-sm mt-2 space-y-1 text-[var(--color-text)]/70">
              <li>• Canjeable en todas las propiedades participantes.</li>
              <li>• Se envía por email al comprador tras el pago.</li>
              <li>• Caducidad de 12 meses.</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
