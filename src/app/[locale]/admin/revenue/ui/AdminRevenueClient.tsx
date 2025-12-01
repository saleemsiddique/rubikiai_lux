"use client";

import React, { useMemo, useState } from "react";
import { formatLithuaniaTime, toLithuaniaISO } from "@/app/[locale]/utils/date";
import { useTranslations } from 'next-intl';

type ReservationRow = {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  houseId: string | null;
  houseIds: string[] | null;
  customerEmail: string | null;
  currency: string;
  totalNightsOnly: number;
  totalStay: number;
  jacuzzi?: any | null;
  jacuzziFee?: number | null;
  includedBase?: number | null;
  extraGuests?: number | null;
  firstNightCharge?: number | null;
  payNow?: number | null;
  payAtArrival?: number | null;
  createdAtIso: string | null;
  updatedAtIso: string | null;
  paidAtIso: string | null;
  confirmationEmailSentAtIso?: string | null;
  customer?: any | null;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  stripeCustomerId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeSessionId?: string | null;
  montonioOrderUuid?: string | null;
  montonioNotification?: any | null;
};

type CouponOrderRow = {
  id: string;
  status: string;
  currency: string;
  quantity: number;
  unitAmount: number;
  unitAmountCents: number;
  buyerEmail: string | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCheckoutUrl: string | null;
  createdAtIso: string | null;
  completedAtIso: string | null;
  lastWebhookAtIso: string | null;
  revenue: number;
};

// Opciones de casas
const HOUSE_OPTIONS = [
  { id: "L0TeFf2LmrWGAaAyS8NY", alias: "Ezero namelis" },
  { id: "PZwbfMYlSXj61uYYJutg", alias: "Šalia Elnių Aptvaro" },
  { id: "oDzv9346CdaAsok162sX", alias: "Elnių Panorama" },
];

const PROPERTY_NAME_MAP: Record<string, string> = {
  "L0TeFf2LmrWGAaAyS8NY": "Ezero Namelis",
  "PZwbfMYlSXj61uYYJutg": "N1",
  "oDzv9346CdaAsok162sX": "N2",
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDaysISO(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function readError(res: Response) {
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j?.error || text;
  } catch {
    return text || `${res.status} ${res.statusText}`;
  }
}

export default function AdminRevenueClient() {
  const t = useTranslations('admin');
  const today = todayISO();
  const monthAgo = addDaysISO(today, -30);

  const [tab, setTab] = useState<"all" | "reservations" | "coupons">("all");
  const [start, setStart] = useState<string>(monthAgo);
  const [end, setEnd] = useState<string>(today);

  // Por defecto: solo lo económicamente relevante
  const [resStatuses, setResStatuses] = useState<string[]>([
    "reserved",
    "complete",
  ]);

  const [houseId, setHouseId] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [orders, setOrders] = useState<CouponOrderRow[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      // RESERVAS
      if (tab === "all" || tab === "reservations") {
        const p = new URLSearchParams();
        p.set("start", start);
        p.set("end", end);
        // no forzamos "by=createdAt" aquí para no filtrar por createdAt en el servidor
        p.set("status", resStatuses.join(","));
        if (houseId) p.set("houseId", houseId);

        const resR = await fetch(`/api/admin/revenue/reservations?${p.toString()}`, { cache: "no-store" });
        if (!resR.ok) throw new Error(await readError(resR));
        const jr = await resR.json();
        const allResults: ReservationRow[] = jr.results || [];

        // --- Filtrado cliente: quedarnos con reservas donde checkIn o checkOut estén en el rango,
        // o que la reserva englobe por completo el rango seleccionado ---
        const toIso = (s?: string | null) => {
          if (!s) return null;
          // normalize to YYYY-MM-DD (handles timestamps like 2025-12-01T13:00:00Z)
          return s.length >= 10 ? s.slice(0, 10) : s;
        };

        const startIso = toIso(start) ?? null; // start y end ya vienen en YYYY-MM-DD
        const endIso = toIso(end) ?? null;

        const overlapsRange = (r: ReservationRow) => {
          const ci = toIso(r.checkIn);
          const co = toIso(r.checkOut);

          // If neither date present, skip (cannot determine)
          if (!ci && !co) return false;

          // checkIn inside range
          if (ci && startIso && endIso && ci >= startIso && ci <= endIso) return true;
          // checkOut inside range
          if (co && startIso && endIso && co >= startIso && co <= endIso) return true;
          // reservation encloses the whole interval (checkIn <= start && checkOut >= end)
          if (ci && co && startIso && endIso && ci <= startIso && co >= endIso) return true;

          return false;
        };

        const filtered = allResults.filter(overlapsRange);
        setReservations(filtered);
      } else {
        setReservations([]);
      }

      // CUPONES (sin cambios)
      if (tab === "all" || tab === "coupons") {
        const p2 = new URLSearchParams();
        p2.set("start", start);
        p2.set("end", end);
        p2.set("by", "completedAt");
        p2.set("status", "completed");

        const resC = await fetch(`/api/admin/revenue/coupon-orders?${p2.toString()}`, { cache: "no-store" });
        if (!resC.ok) throw new Error(await readError(resC));
        const jc = await resC.json();
        setOrders(jc.results || []);
      } else {
        setOrders([]);
      }
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  // helpers seguros
  const num = (v: any) => {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  };

  // Métricas reservas (usando los nuevos campos)
  const resMetrics = useMemo(() => {
    let count = 0;
    let totalContracted = 0; // totalStay (total de todas las reservas)
    let totalCollected = 0; // lo que REALMENTE se ha cobrado
    let totalPending = 0; // lo que falta por cobrar

    reservations.forEach((r) => {
      count++;
      // Total = precio completo (antes de descuentos)
      const totalFull = num((r as any).grandTotal ?? r.totalStay);
      const payNow = num(r.payNow);

      totalContracted += totalFull;

      // Calcular lo que realmente se ha cobrado (MISMA LÓGICA QUE AdminBookingsClient)
      const amountPaidValue = (r as any).amountPaid != null ? num((r as any).amountPaid) : null;
      const actuallyPaid = (r as any).paidInFull
        ? totalFull
        : (amountPaidValue != null ? amountPaidValue : ((r as any).paidAt ? payNow : 0));

      totalCollected += actuallyPaid;
      totalPending += Math.max(0, totalFull - actuallyPaid);
    });

    return { count, totalContracted, totalCollected, totalPending };
  }, [reservations]);

  // Métricas cupones
  const couponMetrics = useMemo(() => {
    let ordersCount = 0;
    let couponsRevenue = 0;
    orders.forEach((o) => {
      ordersCount++;
      couponsRevenue += Number(o.revenue || 0);
    });
    return { ordersCount, couponsRevenue };
  }, [orders]);

  // Métrica combinada
  const combined = useMemo(() => {
    const collected = resMetrics.totalCollected + couponMetrics.couponsRevenue;
    const contracted = resMetrics.totalContracted + couponMetrics.couponsRevenue;
    const pending = resMetrics.totalPending;
    return { collected, contracted, pending };
  }, [resMetrics, couponMetrics]);

  // Exportación Excel
  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet: Reservations
      const resData = reservations.map((r) => ({
        id: r.id,
        status: r.status,
        checkin: r.checkIn,
        checkout: r.checkOut,
        nights: r.nights,
        guests: r.guests,
        customer: r.customerEmail ?? r.email ?? "",
        name: r.name ?? "",
        phone: r.phone ?? "",
        currency: r.currency,
        totalNightsOnly: num(r.totalNightsOnly),
        jacuzziFee: num(r.jacuzziFee),
        totalFull: num((r as any).grandTotal ?? r.totalStay),
        totalStay: num(r.totalStay),
        payNow: num(r.payNow),
        payAtArrival: num(r.payAtArrival),
        amountPaid: num((r as any).amountPaid ?? 0),
        stripeSessionId: r.stripeSessionId ?? "",
        montonioOrderUuid: r.montonioOrderUuid ?? "",
        paidAt: toLithuaniaISO(r.paidAtIso),
        createdAt: toLithuaniaISO(r.createdAtIso),
      }));
      const wsRes = XLSX.utils.json_to_sheet(resData);
      XLSX.utils.book_append_sheet(wb, wsRes, "Reservations");

      // Sheet: CouponOrders
      const ordData = orders.map((o) => ({
        id: o.id,
        status: o.status,
        buyerEmail: o.buyerEmail ?? "",
        quantity: o.quantity,
        unitAmount: o.unitAmount,
        currency: o.currency,
        revenue: o.revenue,
        createdAt: toLithuaniaISO(o.createdAtIso),
        completedAt: toLithuaniaISO(o.completedAtIso),
      }));
      const wsOrd = XLSX.utils.json_to_sheet(ordData);
      XLSX.utils.book_append_sheet(wb, wsOrd, "CouponOrders");

      // Sheet: Summary
      const summaryRows = [
        ["Reservas (cantidad)", reservations.length],
        ["Reservas - cobrado", resMetrics.totalCollected],
        ["Reservas - pendiente", resMetrics.totalPending],
        ["Reservas - total contratado", resMetrics.totalContracted],
        ["Cupones (cantidad)", couponMetrics.ordersCount],
        ["Cupones - cobrado", couponMetrics.couponsRevenue],
        ["TOTAL COBRADO (res+cupones)", combined.collected],
        ["TOTAL CONTRACTUAL", combined.contracted],
        ["TOTAL PENDIENTE", combined.pending],
      ];
      const wsSum = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSum, "Summary");

      const fname = `rubikiai_revenue_${start}_to_${end}.xlsx`;
      XLSX.writeFile(wb, fname);
    } catch (e: any) {
      alert(e?.message || "No se pudo exportar a Excel");
    }
  };

  const StatusPill = ({ s }: { s: string }) => (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]">
      {s}
    </span>
  );

  return (
    <div className="mt-6">
      {/* Filtros */}
      <div className="bg-white border rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="flex flex-col">
          <label className="text-xs text-neutral-600">{t('revenue.filters.from')}</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 border rounded-md p-2"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-600">{t('revenue.filters.to')}</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 border rounded-md p-2"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-600">{t('revenue.filters.house')}</label>
          <select
            value={houseId}
            onChange={(e) => setHouseId(e.target.value)}
            className="mt-1 border rounded-md p-2"
          >
            <option value="">{t('common.allHouses')}</option>
            {HOUSE_OPTIONS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.alias}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4 flex flex-col md:flex-row flex-wrap gap-2 items-center">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="text-xs text-neutral-600">{t('revenue.filters.reservationStates')}</label>

            {["reserved", "complete", "admin", "canceled"].map((s) => {
              const checked = resStatuses.includes(s);
              return (
                <label
                  key={s}
                  className="inline-flex items-center gap-1 text-xs border rounded-md px-2 py-1"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setResStatuses((prev) =>
                        e.target.checked
                          ? Array.from(new Set([...prev, s]))
                          : prev.filter((x) => x !== s)
                      )
                    }
                  />
                  {s}
                </label>
              );
            })}
          </div>

          <div className="ml-0 md:ml-auto flex gap-2 w-full md:w-auto">
            <button
              onClick={fetchAll}
              disabled={loading}
              className="w-full md:w-auto rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {loading ? t('common.loading') : t('common.search')}
            </button>

            <button
              onClick={exportExcel}
              disabled={
                loading || (reservations.length === 0 && orders.length === 0)
              }
              className="w-full md:w-auto rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
            >
              {t('revenue.filters.exportExcel')}
            </button>
          </div>
        </div>

        {err && (
          <div className="md:col-span-4 text-sm text-red-600 whitespace-pre-wrap">
            {err}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {[
          { key: "all", label: t('revenue.tabs.all') },
          { key: "reservations", label: t('revenue.tabs.reservations') },
          { key: "coupons", label: t('revenue.tabs.coupons') },
        ].map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key as any)}
            className={`px-3 py-1 rounded-md border text-sm ${tab === tabItem.key
              ? "bg-[var(--color-primary)] text-white"
              : "bg-white hover:bg-neutral-50"
              }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Resumen */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-neutral-600">{t('revenue.summary.reservations')}</div>
          <div className="mt-1 text-lg font-semibold">{t('revenue.summary.reservationsCount', { count: resMetrics.count })}</div>
          <div className="text-xs text-neutral-600 mt-1">
            {t('revenue.summary.totalContracted')} <b>{resMetrics.totalContracted.toFixed(2)} €</b>
          </div>
          <div className="text-xs text-neutral-600">
            {t('revenue.summary.collectedNow')} <b>{resMetrics.totalCollected.toFixed(2)} €</b>
          </div>
          <div className="text-xs text-neutral-600">
            {t('revenue.summary.pendingArrival')} <b>{resMetrics.totalPending.toFixed(2)} €</b>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-neutral-600">{t('revenue.summary.coupons')}</div>
          <div className="mt-1 text-lg font-semibold">{t('revenue.summary.ordersCount', { count: couponMetrics.ordersCount })}</div>
          <div className="text-xs text-neutral-600">
            {t('revenue.summary.couponRevenue')} <b>{couponMetrics.couponsRevenue.toFixed(2)} €</b>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-neutral-600">{t('revenue.summary.combined')}</div>
          <div className="mt-1 text-lg font-semibold">{t('revenue.summary.collectedLabel')} {combined.collected.toFixed(2)} €</div>
          <div className="text-xs text-neutral-600">{t('revenue.summary.contractual')} {combined.contracted.toFixed(2)} €</div>
          <div className="text-xs text-neutral-600">{t('revenue.summary.pending')} {combined.pending.toFixed(2)} €</div>
        </div>
      </div>

      {/* Tabla de reservas */}
      {(tab === "all" || tab === "reservations") && (
        <div className="mt-6 bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-semibold">{t('revenue.table.reservations')}</div>
          {reservations.length === 0 ? (
            <div className="p-4 text-sm text-neutral-600">{t('common.noResults')}</div>
          ) : (
            <>
              {/* MOBILE: Card list */}
              <div className="md:hidden divide-y">
                {reservations.map((r) => {
                  const paymentMethod = r.stripeSessionId
                    ? "Stripe"
                    : r.montonioOrderUuid
                      ? "Montonio"
                      : "—";

                  const houseName =
                    r.houseIds && r.houseIds.length > 1
                      ? r.houseIds.map((id: string) => PROPERTY_NAME_MAP[id] || id).join(" + ")
                      : PROPERTY_NAME_MAP[r.houseId || r.houseIds?.[0] || ""] || r.houseId || r.houseIds?.[0] || "—";

                  // Total = precio completo (antes de descuentos)
                  const totalFull = num((r as any).grandTotal ?? r.totalStay);
                  const payNow = num(r.payNow);
                  const amountPaidValue = (r as any).amountPaid != null ? num((r as any).amountPaid) : null;
                  const actuallyPaid = (r as any).paidInFull ? totalFull : (amountPaidValue != null ? amountPaidValue : ((r as any).paidAt ? payNow : 0));
                  const pending = Math.max(0, totalFull - actuallyPaid);

                  return (
                    <div key={r.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-sm font-semibold">
                            {r.checkIn} → {r.checkOut}
                          </div>
                          <div className="text-xs text-neutral-600 mt-1">
                            {houseName}
                          </div>

                          <div className="mt-2 text-xs text-neutral-700">
                            <div>{r.customerEmail ?? r.email ?? "—"}</div>
                            <div className="mt-1">
                              <span className="mr-2">{r.guests ?? "—"} huéspedes</span>
                              <span className="text-neutral-500">({r.nights ?? "?"}n)</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-semibold">{totalFull.toFixed(2)}€</div>
                          <div className="text-xs text-neutral-600 mt-1">Paid: {actuallyPaid.toFixed(2)}€</div>
                          {pending > 0 && (
                            <div className="text-xs text-orange-600">Pending: {pending.toFixed(2)}€</div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StatusPill s={r.status} />
                          {r.paidAtIso && (
                            <div className="text-[11px] text-green-600">✓ Paid</div>
                          )}
                        </div>

                        <div className="text-xs text-neutral-600">{paymentMethod}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP / TABLET */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-neutral-700">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('revenue.table.dates')}</th>
                      <th className="px-3 py-2 text-left">{t('common.status')}</th>
                      <th className="px-3 py-2 text-left">{t('common.house')}</th>
                      <th className="px-3 py-2 text-left">{t('revenue.table.guests')}</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-right">{t('revenue.table.totalContract')}</th>
                      <th className="px-3 py-2 text-right">{t('revenue.table.collected')}</th>
                      <th className="px-3 py-2 text-right">{t('revenue.table.pending')}</th>
                      <th className="px-3 py-2 text-left">{t('revenue.table.payment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r) => {
                      const paymentMethod = r.stripeSessionId
                        ? "Stripe"
                        : r.montonioOrderUuid
                          ? "Montonio"
                          : "—";

                      const houseName =
                        r.houseIds && r.houseIds.length > 1
                          ? r.houseIds.map((id: string) => PROPERTY_NAME_MAP[id] || id).join(" + ")
                          : PROPERTY_NAME_MAP[r.houseId || r.houseIds?.[0] || ""] || r.houseId || r.houseIds?.[0] || "—";

                      // Total = precio completo (antes de descuentos)
                      const totalFull = num((r as any).grandTotal ?? r.totalStay);
                      const payNow = num(r.payNow);
                      const amountPaidValue = (r as any).amountPaid != null ? num((r as any).amountPaid) : null;
                      const actuallyPaid = (r as any).paidInFull ? totalFull : (amountPaidValue != null ? amountPaidValue : ((r as any).paidAt ? payNow : 0));
                      const pending = Math.max(0, totalFull - actuallyPaid);

                      return (
                        <tr key={r.id} className="border-t">
                          <td className="px-3 py-2">
                            {r.checkIn} → {r.checkOut}{" "}
                            <span className="text-[10px] text-neutral-500">({r.nights ?? "?"}n)</span>
                          </td>
                          <td className="px-3 py-2">
                            <StatusPill s={r.status} />
                          </td>
                          <td className="px-3 py-2">{houseName}</td>
                          <td className="px-3 py-2">{r.guests ?? "—"}</td>
                          <td className="px-3 py-2">{r.customerEmail ?? r.email ?? "—"}</td>
                          <td className="px-3 py-2 text-right">{totalFull.toFixed(2)}€</td>
                          <td className="px-3 py-2 text-right">{actuallyPaid.toFixed(2)}€</td>
                          <td className="px-3 py-2 text-right">{pending.toFixed(2)}€</td>
                          <td className="px-3 py-2 text-xs">{paymentMethod}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabla cupones */}
      {(tab === "all" || tab === "coupons") && (
        <div className="mt-6 bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-semibold">{t('revenue.table.couponsSold')}</div>
          {orders.length === 0 ? (
            <div className="p-4 text-sm text-neutral-600">{t('common.noResults')}</div>
          ) : (
            <>
              {/* MOBILE: Card list */}
              <div className="md:hidden divide-y">
                {orders.map((o) => (
                  <div key={o.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold">{formatLithuaniaTime(o.completedAtIso || o.createdAtIso, { dateOnly: true })}</div>
                        <div className="text-xs text-neutral-600 mt-1">{o.buyerEmail ?? "—"}</div>
                        <div className="text-xs text-neutral-600 mt-1">Cant.: {o.quantity} · Unit: {o.unitAmount.toFixed(2)} {o.currency}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{o.revenue.toFixed(2)}€</div>
                        <div className="text-xs text-neutral-600 mt-1">{o.status}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP / TABLET */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-neutral-700">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('revenue.table.date')}</th>
                      <th className="px-3 py-2 text-left">{t('revenue.table.buyer')}</th>
                      <th className="px-3 py-2 text-left">{t('revenue.table.quantity')}</th>
                      <th className="px-3 py-2 text-left">{t('revenue.table.unit')}</th>
                      <th className="px-3 py-2 text-right">{t('revenue.table.revenue')}</th>
                      <th className="px-3 py-2 text-left">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-t">
                        <td className="px-3 py-2">{formatLithuaniaTime(o.completedAtIso || o.createdAtIso, { dateOnly: true })}</td>
                        <td className="px-3 py-2">{o.buyerEmail ?? "—"}</td>
                        <td className="px-3 py-2">{o.quantity}</td>
                        <td className="px-3 py-2">{o.unitAmount.toFixed(2)} {o.currency}</td>
                        <td className="px-3 py-2 text-right">{o.revenue.toFixed(2)}€</td>
                        <td className="px-3 py-2">{o.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
