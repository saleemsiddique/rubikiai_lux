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

export default function AdminDiscountsClient({
  adminEmail,
}: {
  adminEmail: string;
}) {
  const [toEmail, setToEmail] = useState("");
  const [percent, setPercent] = useState("10"); // string, entero
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSend = async () => {
    setMsg(null);

    // Validaciones básicas en cliente
    const pInt = parseInt(percent, 10);
    if (!toEmail.trim()) {
      setMsg("Falta el email destino.");
      return;
    }
    if (
      !Number.isFinite(pInt) ||
      pInt <= 0 ||
      pInt > 100 ||
      String(pInt) !== percent.trim()
    ) {
      // también validamos que no meta decimales tipo "10.5"
      setMsg("El porcentaje debe ser un entero entre 1 y 100.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/discounts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail,
          percent: pInt,
          // ya NO mandamos expiresAt ni code; el backend los genera
        }),
      });

      if (!res.ok) {
        const detail = await readError(res);
        throw new Error(detail);
      }

      const data = await res.json();
      if (data.warning) {
        setMsg(
          `Código creado (${data.id}) pero el email NO se pudo enviar automáticamente.\n` +
            `Revisa percentage_discounts en Firestore.`
        );
      } else {
        setMsg(
          `Descuento creado y enviado correctamente a ${toEmail}. ID: ${
            data.id || "?"
          }`
        );
      }

      // podríamos limpiar email/percent si quieres:
      // setToEmail("");
      // setPercent("10");
    }
    catch (e: any) {
      console.error("discount create error:", e);
      setMsg(`Error: ${e?.message || "No se pudo enviar"}`);
    }
    finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Email destino */}
        <div className="flex flex-col">
          <label className="text-xs text-neutral-600 font-medium">
            Email destino
          </label>
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
          <label className="text-xs text-neutral-600 font-medium">
            % Descuento
          </label>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            className="mt-1 border rounded-md p-2 text-sm"
            value={percent}
            onChange={(e) => {
              // Forzamos solo enteros positivos en UI, sin decimales
              const raw = e.target.value;
              // Permitimos string vacío temporalmente para que pueda borrar
              if (raw === "") {
                setPercent("");
                return;
              }
              // Validamos que sea dígitos enteros
              if (!/^\d+$/.test(raw)) return;
              const n = parseInt(raw, 10);
              if (n < 1 || n > 100) return;
              setPercent(String(n));
            }}
          />
          <div className="text-[11px] text-neutral-500 mt-1">
            Ej: 5, 10, 20… (máx 100%)
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
    </div>
  );
}
