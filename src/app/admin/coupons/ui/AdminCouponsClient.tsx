"use client";

import React, { useCallback, useState } from "react";

/** Tipos del lookup existente (/api/coupons/lookup) */
type CouponLookup = {
  kind: "coupon";
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

type PercentLookup = {
  kind: "percent";
  percentDoc: {
    id: string;
    code: string;
    percent: number;
    expiresAt: string;
    used: boolean;
  };
  state: "active" | "expired" | "used" | "disabled";
};

type LookupResult = CouponLookup | PercentLookup;

async function readError(res: Response) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json?.error || JSON.stringify(json);
  } catch {
    return text || `${res.status} ${res.statusText}`;
  }
}

export default function AdminCouponsClient() {
  const [codeInput, setCodeInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);

  // edición de remaining
  const [editRemaining, setEditRemaining] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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

  const doLookup = useCallback(async () => {
    const raw = codeInput.trim();
    if (!raw) {
      setLookupError("Introduce un código de cupón");
      setLookup(null);
      return;
    }
    try {
      setLookupLoading(true);
      setSaveMsg(null);
      setLookupError(null);
      setLookup(null);

      const res = await fetch(`/api/coupons/lookup?code=${encodeURIComponent(raw)}`, { cache: "no-store" });
      if (res.status === 404) {
        setLookupError("Cupón no encontrado");
        return;
      }
      if (!res.ok) {
        const detail = await readError(res);
        throw new Error(detail);
      }
      const data: LookupResult = await res.json();
      setLookup(data);
      if (data.kind === "coupon") {
        setEditRemaining(String(data.coupon.remaining));
      }
    } catch (e: any) {
      console.error("[admin/coupons] lookup error:", e);
      setLookupError(e?.message || "No se pudo consultar el cupón");
    } finally {
      setLookupLoading(false);
    }
  }, [codeInput]);

  const updateRemaining = useCallback(async () => {
    if (!lookup || lookup.kind !== "coupon") return;
    const val = editRemaining.trim();
    if (!val) {
      setSaveMsg("Introduce un valor numérico.");
      return;
    }
    const num = Number(val.replace(",", "."));
    if (!Number.isFinite(num) || num < 0) {
      setSaveMsg("El saldo debe ser un número mayor o igual a 0.");
      return;
    }

    try {
      setSaving(true);
      setSaveMsg(null);
      const res = await fetch(`/api/admin/coupons/${encodeURIComponent(lookup.coupon.id)}/remaining`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remaining: num }),
      });
      if (!res.ok) {
        const detail = await readError(res);
        throw new Error(detail);
      }
      const updated: CouponLookup["coupon"] = await res.json();

      // refrescamos estado local
      setLookup({
        ...lookup,
        coupon: {
          ...lookup.coupon,
          remaining: updated.remaining,
        },
      });
      setEditRemaining(String(updated.remaining));
      setSaveMsg("Saldo actualizado correctamente.");
    } catch (e: any) {
      console.error("[admin/coupons] update error:", e);
      setSaveMsg(`Error: ${e?.message || "No se pudo actualizar el saldo"}`);
    } finally {
      setSaving(false);
    }
  }, [lookup, editRemaining]);

  return (
    <div className="mt-6 bg-white border rounded-xl p-4">
      {/* Buscador */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
        <div className="flex-1">
          <label className="block text-xs text-neutral-600">Código de cupón</label>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="ABCD-EFGH"
            className="w-full mt-1 p-2 rounded-md border"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={doLookup}
            disabled={lookupLoading}
            className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
          >
            {lookupLoading ? "Buscando…" : "Buscar"}
          </button>
          <button
            type="button"
            onClick={() => { setCodeInput(""); setLookup(null); setLookupError(null); setSaveMsg(null); }}
            className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Limpiar
          </button>
        </div>
      </div>

      {lookupError && <div className="mt-3 text-sm text-red-600 whitespace-pre-wrap">{lookupError}</div>}

      {/* Resultado - Cupón de valor */}
      {lookup && lookup.kind === "coupon" && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">Tipo</div>
            <div className="mt-1 text-lg font-semibold text-blue-600">Cupón de valor</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">Estado</div>
            <div className="mt-2">{statePill(lookup.state)}</div>
            <div className="mt-2 text-xs text-neutral-500">Sistema: {lookup.coupon.status}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">Código</div>
            <div className="mt-1 font-mono text-lg">{lookup.coupon.code}</div>
            {lookup.coupon.orderId && (
              <div className="text-xs text-neutral-500 mt-1">Order: <span className="font-mono">{lookup.coupon.orderId}</span></div>
            )}
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">Importes</div>
            <div className="mt-1 text-sm">Original: <span className="font-semibold">{lookup.coupon.unitAmount.toFixed(2)} {lookup.coupon.currency}</span></div>
            <div className="mt-1">Caduca: <span className="font-semibold">{formatDate(lookup.coupon.expiresAtIso)}</span></div>
            <div className="mt-1 text-xs text-neutral-500">Comprado: {formatDate(lookup.coupon.purchasedAtIso)}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white md:col-span-2">
            <div className="text-xs uppercase tracking-wider text-neutral-600">Información adicional</div>
            {lookup.coupon.buyerEmail && (
              <div className="mt-1 text-sm">Comprador: <span className="font-mono">{lookup.coupon.buyerEmail}</span></div>
            )}
            {lookup.coupon.orderId && (
              <div className="text-sm mt-1">ID de pedido: <span className="font-mono">{lookup.coupon.orderId}</span></div>
            )}
          </div>

          {/* Editor de remaining */}
          <div className="md:col-span-3 p-4 rounded-xl border bg-white">
            <div className="text-sm font-semibold">Editar saldo disponible</div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-neutral-600">Saldo actual</label>
                <div className="mt-1 p-2 rounded-md border bg-neutral-50">
                  {lookup.coupon.remaining.toFixed(2)} {lookup.coupon.currency}
                </div>
              </div>
              <div>
                <label className="block text-xs text-neutral-600">Nuevo saldo</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={editRemaining}
                  onChange={(e) => setEditRemaining(e.target.value)}
                  className="mt-1 w-full rounded-md border p-2"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={updateRemaining}
                  disabled={saving}
                  className="w-full rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </div>
            {saveMsg && <div className="mt-2 text-xs whitespace-pre-wrap">{saveMsg}</div>}
          </div>
        </div>
      )}

      {/* Resultado - Descuento porcentual */}
      {lookup && lookup.kind === "percent" && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">Tipo</div>
            <div className="mt-1 text-lg font-semibold text-purple-600">Descuento porcentual</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">Estado</div>
            <div className="mt-2">{statePill(lookup.state)}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">Descuento</div>
            <div className="mt-1 text-3xl font-bold text-[var(--color-primary-dark)]">{lookup.percentDoc.percent}%</div>
            <div className="text-xs text-neutral-500">Sobre total reserva</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">Código</div>
            <div className="mt-1 font-mono text-lg">{lookup.percentDoc.code}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">Caducidad</div>
            <div className="mt-1 text-lg font-semibold">{lookup.percentDoc.expiresAt || "Sin caducidad"}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">Uso</div>
            <div className="mt-1 text-lg font-semibold">{lookup.percentDoc.used ? "Ya usado" : "Disponible"}</div>
          </div>

          <div className="md:col-span-3 p-4 rounded-xl border bg-amber-50">
            <div className="text-sm text-amber-800">
              Los cupones de descuento porcentual no tienen saldo editable. Solo se pueden usar una vez.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}