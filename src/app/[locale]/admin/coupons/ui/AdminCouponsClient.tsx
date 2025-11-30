"use client";

import React, { useCallback, useState } from "react";
import { formatLithuaniaTime } from "@/app/[locale]/utils/date";
import { useLocale, useTranslations } from 'next-intl';

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
  const t = useTranslations('admin');
  const locale = useLocale();
  const [codeInput, setCodeInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);

  // edición de remaining
  const [editRemaining, setEditRemaining] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Usa formatLithuaniaTime para mostrar fechas en hora de Lituania
  const formatDate = (iso: string | null) => {
    return formatLithuaniaTime(iso, { dateOnly: true });
  };

  const statePill = (state?: LookupResult["state"]) => {
    const map: Record<LookupResult["state"], string> = {
      active: "bg-emerald-100 text-emerald-700 border-emerald-200",
      used: "bg-amber-100 text-amber-700 border-amber-200",
      expired: "bg-rose-100 text-rose-700 border-rose-200",
      disabled: "bg-gray-100 text-gray-700 border-gray-200",
    };
    const label: Record<LookupResult["state"], string> = {
      active: t('coupons.state.active'),
      used: t('coupons.state.used'),
      expired: t('coupons.state.expired'),
      disabled: t('coupons.state.disabled'),
    };
    if (!state) return null;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${map[state]}`}>{label[state]}</span>
    );
  };

  const doLookup = useCallback(async () => {
    const raw = codeInput.trim();
    if (!raw) {
      setLookupError(t('coupons.errors.enterCode'));
      setLookup(null);
      return;
    }
    try {
      setLookupLoading(true);
      setSaveMsg(null);
      setLookupError(null);
      setLookup(null);

      const res = await fetch(`/${locale}/api/coupons/lookup?code=${encodeURIComponent(raw)}`, { cache: "no-store" });
      if (res.status === 404) {
        setLookupError(t('coupons.errors.notFound'));
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
      setLookupError(e?.message || t('coupons.errors.notFound'));
    } finally {
      setLookupLoading(false);
    }
  }, [codeInput, locale, t]);

  const updateRemaining = useCallback(async () => {
    if (!lookup || lookup.kind !== "coupon") return;
    const val = editRemaining.trim();
    if (!val) {
      setSaveMsg(t('coupons.errors.enterNumericValue'));
      return;
    }
    const num = Number(val.replace(",", "."));
    if (!Number.isFinite(num) || num < 0) {
      setSaveMsg(t('coupons.errors.balanceGreaterZero'));
      return;
    }

    try {
      setSaving(true);
      setSaveMsg(null);
      const res = await fetch(`/${locale}/api/admin/coupons/${encodeURIComponent(lookup.coupon.id)}/remaining`, {
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
      setSaveMsg(t('coupons.editBalance.successMessage'));
    } catch (e: any) {
      console.error("[admin/coupons] update error:", e);
      setSaveMsg(`Error: ${e?.message || t('coupons.errors.balanceGreaterZero')}`);
    } finally {
      setSaving(false);
    }
  }, [lookup, editRemaining, locale, t]);

  return (
    <div className="mt-6 bg-white border rounded-xl p-4">
      {/* Buscador */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
        <div className="flex-1">
          <label className="block text-xs text-neutral-600">{t('coupons.title')}</label>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder={t('coupons.searchPlaceholder')}
            className="w-full mt-1 p-2 rounded-md border"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={doLookup}
            disabled={lookupLoading}
            className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
          >
            {lookupLoading ? t('common.searching') : t('common.search')}
          </button>
          <button
            type="button"
            onClick={() => { setCodeInput(""); setLookup(null); setLookupError(null); setSaveMsg(null); }}
            className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50"
          >
            {t('common.clear')}
          </button>
        </div>
      </div>

      {lookupError && <div className="mt-3 text-sm text-red-600 whitespace-pre-wrap">{lookupError}</div>}

      {/* Resultado - Cupón de valor */}
      {lookup && lookup.kind === "coupon" && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">{t('coupons.type.title')}</div>
            <div className="mt-1 text-lg font-semibold text-blue-600">{t('coupons.type.valueCoupon')}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">{t('coupons.state.title')}</div>
            <div className="mt-2">{statePill(lookup.state)}</div>
            <div className="mt-2 text-xs text-neutral-500">{t('coupons.state.system')} {lookup.coupon.status}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">{t('coupons.code')}</div>
            <div className="mt-1 font-mono text-lg">{lookup.coupon.code}</div>
            {lookup.coupon.orderId && (
              <div className="text-xs text-neutral-500 mt-1">{t('coupons.order')} <span className="font-mono">{lookup.coupon.orderId}</span></div>
            )}
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">{t('coupons.amounts.title')}</div>
            <div className="mt-1 text-sm">{t('coupons.amounts.original')} <span className="font-semibold">{lookup.coupon.unitAmount.toFixed(2)} {lookup.coupon.currency}</span></div>
            <div className="mt-1">{t('coupons.amounts.expires')} <span className="font-semibold">{formatDate(lookup.coupon.expiresAtIso)}</span></div>
            <div className="mt-1 text-xs text-neutral-500">{t('coupons.amounts.purchased')} {formatDate(lookup.coupon.purchasedAtIso)}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white md:col-span-2">
            <div className="text-xs uppercase tracking-wider text-neutral-600">{t('coupons.additionalInfo.title')}</div>
            {lookup.coupon.buyerEmail && (
              <div className="mt-1 text-sm">{t('coupons.additionalInfo.buyer')} <span className="font-mono">{lookup.coupon.buyerEmail}</span></div>
            )}
            {lookup.coupon.orderId && (
              <div className="text-sm mt-1">{t('coupons.additionalInfo.orderId')} <span className="font-mono">{lookup.coupon.orderId}</span></div>
            )}
          </div>

          {/* Editor de remaining */}
          <div className="md:col-span-3 p-4 rounded-xl border bg-white">
            <div className="text-sm font-semibold">{t('coupons.editBalance.title')}</div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-neutral-600">{t('coupons.editBalance.currentBalance')}</label>
                <div className="mt-1 p-2 rounded-md border bg-neutral-50">
                  {lookup.coupon.remaining.toFixed(2)} {lookup.coupon.currency}
                </div>
              </div>
              <div>
                <label className="block text-xs text-neutral-600">{t('coupons.editBalance.newBalance')}</label>
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
                  {saving ? t('common.saving') : t('common.saveChanges')}
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
            <div className="text-xs uppercase tracking-wider text-neutral-600">{t('coupons.type.title')}</div>
            <div className="mt-1 text-lg font-semibold text-purple-600">{t('coupons.type.percentDiscount')}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">{t('coupons.state.title')}</div>
            <div className="mt-2">{statePill(lookup.state)}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">{t('coupons.discount.title')}</div>
            <div className="mt-1 text-3xl font-bold text-[var(--color-primary-dark)]">{lookup.percentDoc.percent}%</div>
            <div className="text-xs text-neutral-500">{t('coupons.discount.onTotal')}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">{t('coupons.code')}</div>
            <div className="mt-1 font-mono text-lg">{lookup.percentDoc.code}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">{t('coupons.expiration')}</div>
            <div className="mt-1 text-lg font-semibold">{lookup.percentDoc.expiresAt || t('coupons.noExpiration')}</div>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <div className="text-xs uppercase tracking-wider text-neutral-600">{t('coupons.usage.title')}</div>
            <div className="mt-1 text-lg font-semibold">{lookup.percentDoc.used ? t('coupons.usage.alreadyUsed') : t('coupons.usage.available')}</div>
          </div>

          <div className="md:col-span-3 p-4 rounded-xl border bg-amber-50">
            <div className="text-sm text-amber-800">
              {t('coupons.percentNote')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}