// app/coupons/montonio/return/ReturnClient.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ReturnClient() {
  const search = useSearchParams();
  const router = useRouter();
  const orderId = search?.get?.("orderId") ?? null;
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!orderId) return;

    let mounted = true;
    let intervalId: any = null;

    const check = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/montonio/order-status?orderId=${encodeURIComponent(orderId)}`);
        if (!res.ok) {
          // si no encontrado -> marcar not_found
          if (res.status === 404) {
            if (!mounted) return;
            setStatus("not_found");
            return;
          }
          const text = await res.text().catch(() => "");
          console.error("order-status error:", res.status, text);
          return;
        }
        const j = await res.json();
        if (!mounted) return;
        const s = (j.status || j.state || "pending").toString();
        setStatus(s);
        // redirige a success si está completado
        if (s === "completed") {
          // opcional: redirigir a página success que muestre códigos
          router.replace(`/coupons/success?orderId=${encodeURIComponent(orderId)}`);
        }
      } catch (e) {
        console.error("order-status fetch failed", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // primer check inmediato
    check();

    // polling cada 2s hasta 15 intentos (~30s)
    intervalId = setInterval(() => {
      setTries((t) => t + 1);
      check();
    }, 2000);

    // stop after ~32s
    const stopTimeout = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
    }, 32000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
      clearTimeout(stopTimeout);
    };
  }, [orderId, router]);

  if (!orderId) {
    return (
      <div className="p-8 max-w-xl bg-white rounded shadow">
        <h2 className="text-xl font-semibold">Orden no encontrada</h2>
        <p className="mt-2 text-sm text-gray-600">Falta el identificador de la orden en la URL.</p>
        <div className="mt-4">
          <a href="/coupons" className="underline">Volver a compra</a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-2">Volviendo del pago por banco</h2>
      <p className="mb-4">Orden: <span className="font-mono">{orderId}</span></p>

      {loading && <p className="text-sm text-gray-600">Comprobando el estado del pago…</p>}

      {status === "completed" && (
        <div className="p-4 bg-emerald-50 rounded">
          <h3 className="font-semibold">Pago completado</h3>
          <p>Gracias — te redirigimos al comprobante.</p>
        </div>
      )}

      {status === "processing" && (
        <div className="p-4 bg-yellow-50 rounded">
          <h3 className="font-semibold">Pago en proceso</h3>
          <p>Esperando confirmación. Si no recibes el cupón en 1 minuto, contacta con soporte.</p>
        </div>
      )}

      {status === "pending" && (
        <div className="p-4 bg-blue-50 rounded">
          <h3 className="font-semibold">Pago pendiente</h3>
          <p>El pago está pendiente. Te notificaremos por correo cuando se confirme.</p>
        </div>
      )}

      {status === "canceled" && (
        <div className="p-4 bg-rose-50 rounded">
          <h3 className="font-semibold">Pago cancelado</h3>
          <p>No se ha completado el pago. Si creaste una orden por error, revisa en tu panel o contacta con soporte.</p>
        </div>
      )}

      {status === "not_found" && (
        <div className="p-4 bg-rose-50 rounded">
          <h3 className="font-semibold">Orden no encontrada</h3>
          <p>No se ha encontrado la orden. Contacta con soporte indicando el identificador si lo tienes.</p>
        </div>
      )}

      {!status && !loading && <p>Comprobando estado…</p>}

      <div className="mt-6">
        <a className="underline" href="/coupons">Volver a compra</a>
      </div>
    </div>
  );
}
