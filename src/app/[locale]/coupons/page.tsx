"use client";
import React, { JSX, useState } from "react";
import { formatLithuaniaTime } from "@/app/[locale]/utils/date";
import { useLocale } from 'next-intl';

const AMOUNTS = [100, 150, 200, 300] as const;

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

export default function CouponPage(): JSX.Element {
  const locale = useLocale();
  const [selected, setSelected] = useState<number>(AMOUNTS[0]);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // Lookup states
  const [codeInput, setCodeInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);

  // Email modal for both payment methods
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'montonio' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Control scroll when modal is open
  React.useEffect(() => {
    if (showEmailModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showEmailModal]);

  const handleBuy = () => {
    setBuyerEmail("");
    setPaymentMethod('stripe');
    setShowEmailModal(true);
  };

  const handleOpenBankModal = () => {
    setBuyerEmail("");
    setPaymentMethod('montonio');
    setShowEmailModal(true);
  };

  const handleConfirmPayment = async () => {
    if (!buyerEmail || !buyerEmail.includes("@")) {
      window.alert("Please enter a valid email to receive the coupon.");
      return;
    }

    try {
      setSubmitting(true);

      if (paymentMethod === 'stripe') {
        // Stripe checkout with email
        const res = await fetch(`/${locale}/api/coupons/create-checkout-session`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ unitAmount: selected, quantity, buyerEmail }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Could not start checkout");
        if (data?.url) {
          setShowEmailModal(false);
          window.location.assign(data.url);
          return;
        }
        throw new Error("Unexpected server response");
      } else if (paymentMethod === 'montonio') {
        // Montonio checkout with email
        const res = await fetch(`/${locale}/api/montonio/coupon/checkout`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ unitAmount: selected, quantity, buyerEmail }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Could not start Montonio checkout");
        const url = data?.url || data?.paymentUrl || data?.payment_url;
        if (url) {
          setShowEmailModal(false);
          window.location.assign(url);
          return;
        }
        throw new Error("Montonio did not return a payment URL");
      }
    } catch (e: any) {
      console.error(e);
      window.alert(e?.message || "Could not start payment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = async () => {
    const raw = codeInput.trim();
    if (!raw) {
      setLookupError("Enter a coupon code");
      setLookup(null);
      return;
    }
    try {
      setLookupLoading(true);
      setLookupError(null);
      setLookup(null);
      const res = await fetch(`/${locale}/api/coupons/lookup?code=${encodeURIComponent(raw)}`);
      if (res.status === 404) {
        setLookupError("Coupon not found");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Could not lookup coupon");
      }
      const data: LookupResult = await res.json();
      setLookup(data);
    } catch (e: any) {
      console.error(e);
      setLookupError(e?.message || "Could not lookup coupon");
    } finally {
      setLookupLoading(false);
    }
  };

  // Usa formatLithuaniaTime para mostrar fechas en hora de Lituania
  const formatDate = (iso: string | null) => {
    return formatLithuaniaTime(iso, { dateOnly: true });
  };

  const statePill = (state?: LookupResult["state"]) => {
    const map: Record<LookupResult["state"], string> = {
      active: "bg-emerald-100 text-emerald-700 border-emerald-300",
      used: "bg-amber-100 text-amber-700 border-amber-300",
      expired: "bg-rose-100 text-rose-700 border-rose-300",
      disabled: "bg-gray-100 text-gray-700 border-gray-300",
    };
    const label: Record<LookupResult["state"], string> = {
      active: "Active",
      used: "Used",
      expired: "Expired",
      disabled: "Disabled",
    };
    if (!state) return null;
    return (
      <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full border ${map[state]}`}>
        {label[state]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-background-soft)] overflow-x-hidden">
      {/* Hero Header - Mobile First */}
      <header className="bg-[var(--color-secondary)] text-white pt-24 md:pt-36 pb-8 px-4 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight">
            Gift Vouchers
          </h1>
          <p className="text-base md:text-lg text-white/90 max-w-xl mx-auto">
            Share unforgettable experiences at Rubikiai Lux
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Purchase Section - Mobile First, Desktop Grid */}
        <section className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-5 md:p-8 lg:grid lg:grid-cols-[1fr,400px] lg:gap-8">
            {/* Left Column - Amount Selection & Preview */}
            <div className="space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text)] mb-4">
                  Select Amount
                </h2>
                
                <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
                  {AMOUNTS.map((amt) => {
                    const active = selected === amt;
                    return (
                      <button
                        key={amt}
                        onClick={() => setSelected(amt)}
                        className={`relative p-4 md:p-6 rounded-xl transition-all duration-200 ${
                          active 
                            ? 'bg-[var(--color-secondary)] text-white shadow-lg scale-[1.02]' 
                            : 'bg-[var(--color-background-main)] text-[var(--color-text)] hover:shadow-md'
                        }`}
                      >
                        <div className="text-xs md:text-sm uppercase tracking-wider opacity-75 mb-1">
                          Voucher
                        </div>
                        <div className="text-3xl md:text-4xl font-black">
                          €{amt}
                        </div>
                        {active && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Voucher Preview Card */}
              <div className="bg-gradient-to-br from-[var(--color-primary-dark)] to-[var(--color-primary)] rounded-xl p-6 text-white shadow-md">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider opacity-80 mb-1">
                      Rubikiai Lux
                    </div>
                    <div className="text-4xl font-black">
                      €{selected}
                    </div>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold">
                    Gift Voucher
                  </div>
                </div>
                
                <div className="space-y-1 text-sm opacity-90">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Valid for 12 months</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                    </svg>
                    <span>Redeemable for accommodation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Sent by email instantly</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Total and Payment (Desktop: Sticky sidebar) */}
            <div className="lg:mt-0 mt-6 border-t lg:border-t-0 lg:border-l border-gray-200 pt-6 lg:pt-0 lg:pl-8">
              <div className="lg:sticky lg:top-8 space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-[var(--color-text)]">Total</span>
                  <span className="text-3xl font-black text-[var(--color-secondary)]">
                    €{(selected * quantity).toFixed(2)}
                  </span>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleBuy}
                    disabled={loading}
                    className="w-full bg-[var(--color-secondary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-[var(--color-secondary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Processing..." : "Pay with Card / PayPal"}
                  </button>

                  <button
                    onClick={handleOpenBankModal}
                    disabled={loading}
                    className="w-full bg-white border-2 border-[var(--color-secondary)] text-[var(--color-secondary)] py-4 rounded-xl font-bold text-lg hover:bg-[var(--color-background-main)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Processing..." : "Pay with Bank Transfer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Check Voucher Section - Mobile First, Desktop 2-Column */}
        <section className="bg-white rounded-2xl shadow-lg p-5 md:p-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8">
            {/* Left Column - Search Form */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[var(--color-secondary)]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[var(--color-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text)]">
                  Check Your Voucher
                </h2>
              </div>

              <p className="text-sm text-[var(--color-text)]/70 mb-4">
                Enter your code to view balance and expiration
              </p>

              <div className="space-y-3">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="ABCD-EFGH"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[var(--color-secondary)] focus:outline-none transition-colors text-lg font-mono"
                />

                <button
                  onClick={handleLookup}
                  disabled={lookupLoading}
                  className="w-full bg-[var(--color-secondary)] text-white py-3 rounded-lg font-semibold hover:bg-[var(--color-secondary)]/90 transition-colors disabled:opacity-50"
                >
                  {lookupLoading ? "Checking..." : "Check Voucher"}
                </button>
              </div>

              {lookupError && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
                  {lookupError}
                </div>
              )}
            </div>

            {/* Right Column - Results */}
            <div className="lg:border-l lg:pl-8 mt-6 lg:mt-0">
              {!lookup && !lookupError && (
                <div className="h-full flex items-center justify-center text-center text-[var(--color-text)]/40">
                  <div>
                    <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">Enter a voucher code to see details</p>
                  </div>
                </div>
              )}

              {lookup && lookup.kind === "coupon" && (
                <div className="space-y-3">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-lg ${
                    lookup.state === 'active' 
                      ? 'bg-emerald-50 border border-emerald-200' 
                      : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--color-text)]/70">Status</span>
                      {statePill(lookup.state)}
                    </div>
                  </div>

                  {/* Balance Card */}
                  <div className="bg-gradient-to-br from-[var(--color-primary-dark)] to-[var(--color-primary)] rounded-xl p-6 text-white">
                    <div className="text-sm opacity-80 mb-2">Available Balance</div>
                    <div className="text-4xl font-black mb-2">
                      €{lookup.coupon.remaining.toFixed(2)}
                    </div>
                    <div className="text-sm opacity-80">
                      Original: €{lookup.coupon.unitAmount.toFixed(2)}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-4 bg-[var(--color-background-main)] rounded-lg">
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text)]/60 mb-1">
                        Voucher Code
                      </div>
                      <div className="font-mono text-lg font-semibold text-[var(--color-text)]">
                        {lookup.coupon.code}
                      </div>
                    </div>

                    <div className="p-4 bg-[var(--color-background-main)] rounded-lg">
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text)]/60 mb-1">
                        Expiration Date
                      </div>
                      <div className="text-lg font-semibold text-[var(--color-text)]">
                        {formatDate(lookup.coupon.expiresAtIso)}
                      </div>
                    </div>

                    <div className="p-4 bg-[var(--color-background-main)] rounded-lg">
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text)]/60 mb-1">
                        Purchase Date
                      </div>
                      <div className="text-lg font-semibold text-[var(--color-text)]">
                        {formatDate(lookup.coupon.purchasedAtIso)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {lookup && lookup.kind === "percent" && (
                <div className="space-y-3">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-lg ${
                    lookup.state === 'active' 
                      ? 'bg-emerald-50 border border-emerald-200' 
                      : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--color-text)]/70">Status</span>
                      {statePill(lookup.state)}
                    </div>
                  </div>

                  {/* Discount Card */}
                  <div className="bg-gradient-to-br from-[var(--color-primary-dark)] to-[var(--color-primary)] rounded-xl p-6 text-white">
                    <div className="text-sm opacity-80 mb-2">Discount</div>
                    <div className="text-5xl font-black mb-2">
                      {lookup.percentDoc.percent}%
                    </div>
                    <div className="text-sm opacity-80">
                      Off total booking
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-4 bg-[var(--color-background-main)] rounded-lg">
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text)]/60 mb-1">
                        Discount Code
                      </div>
                      <div className="font-mono text-lg font-semibold text-[var(--color-text)]">
                        {lookup.percentDoc.code}
                      </div>
                    </div>

                    <div className="p-4 bg-[var(--color-background-main)] rounded-lg">
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text)]/60 mb-1">
                        Expiration
                      </div>
                      <div className="text-lg font-semibold text-[var(--color-text)]">
                        {lookup.percentDoc.expiresAt || "No expiration"}
                      </div>
                    </div>

                    <div className="p-4 bg-[var(--color-background-main)] rounded-lg">
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text)]/60 mb-1">
                        Usage Status
                      </div>
                      <div className="text-lg font-semibold text-[var(--color-text)]">
                        {lookup.percentDoc.used ? "Already used" : "Available"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Info Section */}
        <section className="bg-[var(--color-secondary)]/5 border border-[var(--color-secondary)]/20 rounded-2xl p-5 md:p-6">
          <h3 className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Important Information
          </h3>
          <ul className="space-y-2 text-sm text-[var(--color-text)]/70">
            <li className="flex gap-2">
              <span className="text-[var(--color-secondary)] font-bold">•</span>
              <span>Vouchers are valid for 12 months from purchase date</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--color-secondary)] font-bold">•</span>
              <span>Redeemable at all Rubikiai Lux properties</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--color-secondary)] font-bold">•</span>
              <span>Non-refundable and subject to availability</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--color-secondary)] font-bold">•</span>
              <span>Sent via email immediately after payment</span>
            </li>
          </ul>
        </section>
      </main>

      {/* Email Modal - Mobile Optimized (for both payment methods) */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4">
          <div
            className="absolute inset-0"
            onClick={() => !submitting && setShowEmailModal(false)}
          />

          <div className="relative z-10 w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-3xl md:rounded-t-2xl">
              <h3 className="text-lg font-bold text-[var(--color-text)]">
                {paymentMethod === 'stripe' ? 'Card / PayPal Payment' : 'Bank Transfer Payment'}
              </h3>
              <button
                onClick={() => !submitting && setShowEmailModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                disabled={submitting}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              <p className="text-sm text-[var(--color-text)]/70">
                Enter your email to receive the voucher after completing the payment.
              </p>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Email Address
                </label>
                <input
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="your@email.com"
                  type="email"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[var(--color-secondary)] focus:outline-none transition-colors"
                  disabled={submitting}
                />
              </div>

              <div className="bg-[var(--color-secondary)]/5 border border-[var(--color-secondary)]/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-[var(--color-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-semibold text-[var(--color-text)]">Order Summary</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text)]/70">Voucher Amount</span>
                  <span className="text-xl font-black text-[var(--color-secondary)]">€{selected}</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={handleConfirmPayment}
                  disabled={submitting}
                  className="w-full bg-[var(--color-secondary)] text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-[var(--color-secondary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Processing..." : paymentMethod === 'stripe' ? 'Continue to Payment' : 'Continue to Bank Transfer'}
                </button>

                <button
                  onClick={() => setShowEmailModal(false)}
                  disabled={submitting}
                  className="w-full bg-white border border-gray-200 text-[var(--color-text)] py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}