"use client";
import React, { JSX, useState } from "react";

const AMOUNTS = [100, 150, 200, 300] as const;

type LookupResult = {
  coupon: {
    id: string;
    code: string;
    currency: string;
    unitAmount: number;
    remaining: number;
    status: string;
    purchasedAtIso: string | null;
    expiresAtIso: string | null;
    orderId: string | null;
    buyerEmail: string | null;
  };
  state: "active" | "expired" | "used" | "disabled";
};

export default function CouponPage(): JSX.Element {
  const [selected, setSelected] = useState<number>(AMOUNTS[0]);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // Lookup states
  const [codeInput, setCodeInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);

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

  const handleLookup = async () => {
    const raw = codeInput.trim();
    if (!raw) {
      setLookupError("Introduce un código de cupón");
      setLookup(null);
      return;
    }
    try {
      setLookupLoading(true);
      setLookupError(null);
      setLookup(null);
      const res = await fetch(`/api/coupons/lookup?code=${encodeURIComponent(raw)}`);
      if (res.status === 404) {
        setLookupError("Cupón no encontrado");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "No se pudo consultar el cupón");
      }
      const data: LookupResult = await res.json();
      setLookup(data);
    } catch (e: any) {
      console.error(e);
      setLookupError(e?.message || "No se pudo consultar el cupón");
    } finally {
      setLookupLoading(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      return iso;
    }
  };

  const statePill = (state?: LookupResult["state"]) => {
    const map: Record<LookupResult["state"], string> = {
      active: "bg-emerald-100 text-emerald-700 border-emerald-200",
      used: "bg-amber-100 text-amber-700 border-amber-200",
      expired: "bg-rose-100 text-rose-700 border-rose-200",
      disabled: "bg-gray-100 text-gray-700 border-gray-200",
    };
    const label: Record<LookupResult["state"], string> = {
      active: "Activo",
      used: "Agotado",
      expired: "Caducado",
      disabled: "Inactivo",
    };
    if (!state) return null;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${map[state]}`}>{label[state]}</span>
    );
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
        {/* Comprar cupones */}
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

        {/* Vista previa */}
        <aside className="bg-[var(--color-background-soft)] rounded-2xl p-6 shadow-xl flex flex-col gap-6 border border-[var(--color-secondary)]/40 h-fit">
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

        {/* Consulta de cupón */}
        <section className="lg:col-span-3 bg-[var(--color-background-soft)] rounded-2xl p-6 shadow-xl border border-[var(--color-secondary)]/40">
          <div className="flex flex-col gap-4">
            <h3 className="text-2xl font-semibold text-[var(--color-primary-dark)]">Consulta tu cupón</h3>
            <p className="text-sm text-[var(--color-text)]/70">Introduce tu código (por ejemplo, <span className="font-mono">ABCD-EFGH</span>) para ver el saldo y la fecha de caducidad.</p>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="block text-sm mb-1 text-[var(--color-text)]">Código de cupón</label>
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="ABCD-EFGH"
                  className="w-full p-3 rounded-lg border-2 border-[var(--color-primary)] bg-white text-base focus:border-[var(--color-secondary)] focus:ring-0 transition"
                />
              </div>
              <div>
                <button
                  onClick={handleLookup}
                  disabled={lookupLoading}
                  className="px-6 py-3 rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed transition-transform duration-200"
                  style={{ background: 'var(--color-secondary)', color: 'white' }}
                >
                  {lookupLoading ? 'Buscando…' : 'Comprobar'}
                </button>
              </div>
            </div>

            {lookupError && (
              <div className="text-sm text-rose-600">{lookupError}</div>
            )}

            {lookup && (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border bg-white">
                  <div className="text-xs uppercase tracking-wider text-[var(--color-text)]/60">Estado</div>
                  <div className="mt-1">{statePill(lookup.state)}</div>
                </div>
                <div className="p-4 rounded-xl border bg-white">
                  <div className="text-xs uppercase tracking-wider text-[var(--color-text)]/60">Saldo disponible</div>
                  <div className="mt-1 text-2xl font-bold text-[var(--color-primary-dark)]">{lookup.coupon.remaining.toFixed(2)} {lookup.coupon.currency}</div>
                  <div className="text-xs text-[var(--color-text)]/60">Importe original: {lookup.coupon.unitAmount.toFixed(2)} {lookup.coupon.currency}</div>
                </div>
                <div className="p-4 rounded-xl border bg-white">
                  <div className="text-xs uppercase tracking-wider text-[var(--color-text)]/60">Caducidad</div>
                  <div className="mt-1 text-lg font-semibold">{formatDate(lookup.coupon.expiresAtIso)}</div>
                  <div className="text-xs text-[var(--color-text)]/60">Comprado el {formatDate(lookup.coupon.purchasedAtIso)}</div>
                </div>

                <div className="p-4 rounded-xl border bg-white md:col-span-3">
                  <div className="text-xs uppercase tracking-wider text-[var(--color-text)]/60">Código</div>
                  <div className="mt-1 font-mono text-lg">{lookup.coupon.code}</div>
                  {lookup.coupon.orderId && (
                    <div className="text-xs text-[var(--color-text)]/60 mt-1">Pedido: <span className="font-mono">{lookup.coupon.orderId}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
