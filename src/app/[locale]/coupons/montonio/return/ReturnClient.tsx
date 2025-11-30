// app/coupons/montonio/return/ReturnClient.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from 'next-intl';
import { Link } from "lucide-react";

export default function ReturnClient() {
  const locale = useLocale();
  const search = useSearchParams();
  const router = useRouter();
  const orderId = search?.get("orderId") ?? null;
  const orderToken = search?.get("order-token") ?? search?.get("orderToken") ?? null;

  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tries, setTries] = useState(0);
  const [consumeResult, setConsumeResult] = useState<string | null>(null);

  // Force webhook processing with order-token
  useEffect(() => {
    if (!orderToken) return;
    let mounted = true;

    (async () => {
      try {
        setConsumeResult("sending");
        const endpoint = `/${locale}/api/montonio/webhook?order-token=${encodeURIComponent(orderToken)}`;
        const res = await fetch(endpoint, { method: "POST" });
        if (!mounted) return;

        if (res.ok) {
          setConsumeResult("ok");
        } else {
          const text = await res.text().catch(() => "");
          console.error("Webhook consume returned", res.status, text);
          setConsumeResult(`error ${res.status}`);
        }
      } catch (e) {
        console.error("Failed to POST order-token to webhook:", e);
        if (mounted) setConsumeResult("network_error");
      }
    })();

    return () => { mounted = false; };
  }, [orderToken]);

  // Poll order status
  useEffect(() => {
    if (!orderId) return;
    let mounted = true;
    let intervalId: any = null;

    const check = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/${locale}/api/montonio/order-status?orderId=${encodeURIComponent(orderId)}`);

        if (!res.ok) {
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

        if (s === "completed") {
          // Clear interval and redirect to success
          if (intervalId) clearInterval(intervalId);
          router.replace(`/${locale}/coupons/success?orderId=${encodeURIComponent(orderId)}`);
        }
      } catch (e) {
        console.error("order-status fetch failed", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Initial check
    check();

    // Poll every 2 seconds
    intervalId = setInterval(() => {
      setTries((t) => t + 1);
      check();
    }, 2000);

    // Stop after 32 seconds
    const stopTimeout = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
    }, 32000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
      clearTimeout(stopTimeout);
    };
  }, [orderId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f4efe9' }}>
      <div className="p-8 max-w-2xl w-full bg-white rounded-xl shadow-xl">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Volviendo del pago por banco</h2>

        <p className="mb-4 text-gray-600">
          Orden: <span className="font-mono font-semibold text-gray-800">{orderId ?? "—"}</span>
        </p>

        {orderToken && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-800">
              Se detectó <span className="font-mono font-semibold">order-token</span> en la URL.
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Estado consumo token: <span className="font-semibold">{consumeResult ?? "pendiente"}</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 text-gray-600 mb-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
            <p className="text-sm">Comprobando el estado del pago… (intento {tries})</p>
          </div>
        )}

        {status === "completed" && (
          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <h3 className="font-semibold text-emerald-800">✓ Pago completado</h3>
            <p className="text-emerald-700 text-sm mt-1">
              Gracias — te redirigimos al comprobante.
            </p>
          </div>
        )}

        {status === "processing" && (
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="font-semibold text-yellow-800">⏳ Pago en proceso</h3>
            <p className="text-yellow-700 text-sm mt-1">
              Esperando confirmación. Si no recibes el cupón en 1 minuto, contacta con soporte.
            </p>
          </div>
        )}

        {status === "pending" && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-800">⏱️ Pago pendiente</h3>
            <p className="text-blue-700 text-sm mt-1">
              El pago está pendiente. Te notificaremos por correo cuando se confirme.
            </p>
          </div>
        )}

        {status === "canceled" && (
          <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
            <h3 className="font-semibold text-rose-800">✕ Pago cancelado</h3>
            <p className="text-rose-700 text-sm mt-1">
              No se ha completado el pago. Si creaste una orden por error, revisa en tu panel o contacta con soporte.
            </p>
          </div>
        )}

        {status === "not_found" && (
          <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
            <h3 className="font-semibold text-rose-800">✕ Orden no encontrada</h3>
            <p className="text-rose-700 text-sm mt-1">
              No se ha encontrado la orden. Contacta con soporte indicando el identificador si lo tienes.
            </p>
          </div>
        )}

        {!status && !loading && (
          <p className="text-gray-600">Comprobando estado…</p>
        )}

        <div className="mt-6 pt-6 border-t">
          <Link
            href="/coupons"
            className="text-blue-600 hover:text-blue-800 underline font-medium"
          >
            ← Volver a compra
          </Link>
        </div>
      </div>
    </div>
  );
}