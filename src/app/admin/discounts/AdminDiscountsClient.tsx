// app/admin/discounts/ui/AdminDiscountsClient.tsx
"use client";

import React, { useState } from "react";

async function readError(res: Response) {
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j?.error || text;
  } catch {
    return text || `${res.status} ${res.statusText}`;
  }
}

export default function AdminDiscountsClient({ adminEmail }: { adminEmail: string }) {
  const [toEmail, setToEmail] = useState("");
  const [percent, setPercent] = useState("10"); // sólo enteros 1..100
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // detalles devueltos por la API tras crear/enviar
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdExpiresAt, setCreatedExpiresAt] = useState<string | null>(null);

  const handleSend = async () => {
    setMsg(null);
    setCreatedId(null);
    setCreatedCode(null);
    setCreatedExpiresAt(null);

    // validaciones cliente
    const pNum = Number(percent);
    if (!toEmail.trim()) {
      setMsg("Falta el email destino.");
      return;
    }
    // solo enteros
    if (!Number.isInteger(pNum) || pNum <= 0 || pNum > 100) {
      setMsg("El porcentaje debe ser un número entero entre 1 y 100.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/discounts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail,
          percent: pNum,
          // ya NO mandamos expiresAt ni code, eso lo hace el server
        }),
      });

      if (!res.ok) {
        const detail = await readError(res);
        throw new Error(detail);
      }

      const data = await res.json();
      // data: { ok: true, id, code, expiresAt, warning? }
      setCreatedId(data.id || null);
      setCreatedCode(data.code || null);
      setCreatedExpiresAt(data.expiresAt || null);

      if (data.warning) {
        setMsg(`Guardado pero fallo al enviar email (${data.warning}).`);
      } else {
        setMsg(`Enviado correctamente a ${toEmail}.`);
      }
    } catch (e: any) {
      console.error("discount create error:", e);
      setMsg(`Error: ${e?.message || "No se pudo enviar"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Email destino */}
        <div className="flex flex-col">
          <label className="text-xs text-neutral-600 font-medium">Email destino</label>
          <input
            type="email"
            className="mt-1 border rounded-md p-2 text-sm"
            placeholder="cliente@example.com"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
          />
        </div>

        {/* % Descuento */}
        <div className="flex flex-col">
          <label className="text-xs text-neutral-600 font-medium">% Descuento</label>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            className="mt-1 border rounded-md p-2 text-sm"
            value={percent}
            onChange={(e) => {
              // forzamos valor entero en el estado
              const raw = e.target.value;
              // Permitimos campo vacío temporalmente para que el user pueda editar
              if (raw === "") {
                setPercent("");
                return;
              }
              const n = Number(raw);
              if (Number.isInteger(n) && n >= 1 && n <= 100) {
                setPercent(String(n));
              } else if (Number.isInteger(n) && n > 100) {
                setPercent("100");
              } else if (Number.isInteger(n) && n < 1) {
                setPercent("1");
              } else {
                // si mete decimales o texto raro, no actualizamos
                // excepto si está borrando -> arriba ya cubierto ""
              }
            }}
          />
          <div className="text-[11px] text-neutral-500 mt-1">
            Solo enteros (ej: 5, 10, 20). Máximo 100%.
          </div>
        </div>
      </div>

      <div className="pt-4 border-t flex items-center gap-3 flex-wrap">
        <button
          disabled={busy}
          onClick={handleSend}
          className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
        >
          {busy ? "Enviando…" : "Crear y enviar descuento"}
        </button>

        {msg && (
          <div className="text-xs whitespace-pre-wrap text-neutral-700">
            {msg}
          </div>
        )}
      </div>

      {(createdId || createdCode || createdExpiresAt) && (
        <div className="text-xs text-neutral-700 bg-neutral-50 border rounded-md p-3 leading-relaxed">
          {createdId && (
            <div>
              <span className="font-semibold">ID:</span> {createdId}
            </div>
          )}
          {createdCode && (
            <div>
              <span className="font-semibold">Código:</span>{" "}
              <span className="font-mono">{createdCode}</span>
            </div>
          )}
          {createdExpiresAt && (
            <div>
              <span className="font-semibold">Expira el:</span> {createdExpiresAt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
