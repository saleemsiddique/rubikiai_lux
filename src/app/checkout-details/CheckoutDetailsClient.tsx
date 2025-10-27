"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface PriceResponse {
  total: number | null;        // lodging + extra guests per night, no jacuzzi
  first: number | null;        // first-night charge estimate (no jacuzzi)
  nights: number;
  extraGuests: number;
  includedBase: number;
  jacuzziFee: number;          // jacuzzi surcharge (flat for whole stay)
  extrasTotal: number;         // currently == jacuzziFee or 0
  grandTotal: number;          // total stay with jacuzzi
  variable: boolean;
  perNightBreakdown: Array<{
    date: string;
    perUnit: Array<{ id: string; price: number | null }>;
    nightTotal: number;
  }>;
}

function formatCurrency(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// Stripe minimum rule: can't leave a charge between 0.01€ and 0.49€
const STRIPE_MIN_CENTS = 50;
function toCents(n: number) {
  return Math.round(n * 100);
}
function fromCents(c: number) {
  return c / 100;
}

/**
 * Use as much credit as possible on first night, but:
 * - don't go below 0
 * - don't leave a remainder between 0.01€ and 0.49€
 */
function applyCreditToFirstNight(firstNight: number, availableCredit: number) {
  // try full use
  let useNow = Math.min(firstNight, availableCredit);
  let remainder = firstNight - useNow;
  const cents = toCents(remainder);

  // If it leaves 0.01 - 0.49€, try snapping to 0.50 or 0.00
  if (cents > 0 && cents < STRIPE_MIN_CENTS) {
    // Option A: leave 0.50€
    const targetA = fromCents(STRIPE_MIN_CENTS); // 0.50
    if (targetA <= firstNight) {
      const altUseA = firstNight - targetA;
      if (altUseA >= 0 && altUseA <= availableCredit + 1e-6) {
        useNow = altUseA;
        remainder = targetA;
        return { used: useNow, payNow: remainder };
      }
    }

    // Option B: leave 0.00€
    const altUseB = firstNight;
    if (altUseB <= availableCredit + 1e-6) {
      useNow = altUseB;
      remainder = 0;
      return { used: useNow, payNow: 0 };
    }
  }

  return { used: useNow, payNow: remainder };
}

export default function CheckoutDetailsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Params from HousePage
  const houseId = searchParams.get("houseId") || ""; // could be single or "a__b"
  const houseSlug = searchParams.get("houseSlug") || "";
  const startIso = searchParams.get("start") || "";
  const endIso = searchParams.get("end") || "";
  const guestsParam = searchParams.get("guests") || "2";
  const guests = Number(guestsParam) || 2;

  // jacuzzi toggle
  const [withJacuzzi, setWithJacuzzi] = useState(false);

  // pricing state from backend
  const [priceData, setPriceData] = useState<PriceResponse | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);

  // user details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [phone, setPhone] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [comment, setComment] = useState("");

  // discount state (lookup + apply happens here now)
  const [discountCode, setDiscountCode] = useState("");
  const [discountLookupLoading, setDiscountLookupLoading] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  /**
   * discountData can be:
   *  { kind: "coupon", coupon: {...}, state }
   *  { kind: "percent", percentDoc: {...}, state }
   *
   * We'll normalize name:
   *  kind: "coupon"  -> fixed euro balance
   *  kind: "percent" -> percentage off (applies ONLY to first night)
   */
  const [discountData, setDiscountData] = useState<any | null>(null);

  // whether the discount is actually applied to this booking flow
  const [discountApplied, setDiscountApplied] = useState(false);

  // how many euros of discount we're effectively applying NOW (for coupons)
  // NOTE: for percent, we'll still set something here (approx), but the real
  // math is computed in computedBreakdown.
  const [appliedEuroDiscount, setAppliedEuroDiscount] = useState<number>(0);

  // validation for email
  const emailsMatch = email.trim() !== "" && email === email2;

  // can we continue to Stripe
  const canSubmit =
    !loadingPrice &&
    !priceError &&
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    emailsMatch &&
    phone.trim() !== "" &&
    priceData !== null;

  // pretty helpers
  const startPretty = startIso
    ? new Date(startIso).toLocaleDateString("en-GB")
    : "-";
  const endPretty = endIso
    ? new Date(endIso).toLocaleDateString("en-GB")
    : "-";

  // derive jacuzzi fee shown
  const jacuzziFeeShown = withJacuzzi ? priceData?.jacuzziFee ?? 0 : 0;

  /**
   * computedBreakdown:
   * - payNowAfterDiscount: what Stripe will try to charge now
   * - totalAfterDiscount: total cost of the stay after applying the discount
   *   (for percent, ONLY first night is discounted, so total goes down by that amount,
   *    NOT by the same % across all nights)
   * - effectiveDiscountUsedNow: how much discount is being applied to "now"
   */
  const computedBreakdown = useMemo(() => {
    if (!priceData) {
      return {
        payNowAfterDiscount: null,
        totalAfterDiscount: null,
        effectiveDiscountUsedNow: 0,
      };
    }

    const firstNightBefore = priceData.first ?? 0; // first night (no jacuzzi)
    const totalBeforeNoJacuzzi = priceData.total ?? 0;
    const fullStayBeforeWithJacuzzi = priceData.grandTotal ?? 0;

    // "Full stay" depends on jacuzzi selection
    const fullStayBefore = withJacuzzi
      ? fullStayBeforeWithJacuzzi
      : totalBeforeNoJacuzzi;

    // no discount applied
    if (!discountApplied || !discountData) {
      return {
        effectiveDiscountUsedNow: 0,
        payNowAfterDiscount: firstNightBefore,
        totalAfterDiscount: fullStayBefore,
      };
    }

    // ---- coupon: fixed euro credit ----
    if (discountData.kind === "coupon" && discountData.coupon) {
      // available credit (already chosen / Stripe-adjusted when we applied)
      const availableCredit = appliedEuroDiscount;

      // how much does that reduce "pay now"?
      const { used: usedNow, payNow } = applyCreditToFirstNight(
        firstNightBefore,
        availableCredit
      );

      // reduce total stay by usedNow
      const totalAfter = Math.max(0, fullStayBefore - usedNow);

      return {
        effectiveDiscountUsedNow: usedNow,
        payNowAfterDiscount: payNow,
        totalAfterDiscount: totalAfter,
      };
    }

    // ---- percent: discount applies ONLY to first night ----
    if (discountData.kind === "percent" && discountData.percentDoc) {
      const pct = Number(discountData.percentDoc.percent ?? 0) / 100;
      const pctClamped = Math.min(Math.max(pct, 0), 1); // [0,1]

      // discount only on first night
      const discountOnFirstNight = firstNightBefore * pctClamped;
      const firstNightAfterPct = firstNightBefore - discountOnFirstNight;

      // total after discount: subtract ONLY what we subtracted from first night
      const totalAfterOnlyFirstNightDiscount = Math.max(
        0,
        fullStayBefore - discountOnFirstNight
      );

      // enforce Stripe "no 0.01€-0.49€" rule on pay-now amount
      const cents = toCents(firstNightAfterPct);
      if (cents > 0 && cents < STRIPE_MIN_CENTS) {
        // Option A: snap to 0.50€
        const target50 = fromCents(STRIPE_MIN_CENTS); // 0.50
        if (target50 <= firstNightBefore) {
          return {
            effectiveDiscountUsedNow: firstNightBefore - target50,
            payNowAfterDiscount: target50,
            totalAfterDiscount: Math.max(
              0,
              fullStayBefore - (firstNightBefore - target50)
            ),
          };
        }

        // Option B: snap to 0.00€
        return {
          effectiveDiscountUsedNow: firstNightBefore,
          payNowAfterDiscount: 0,
          totalAfterDiscount: Math.max(
            0,
            fullStayBefore - firstNightBefore
          ),
        };
      }

      // Normal case: pay firstNightAfterPct now
      return {
        effectiveDiscountUsedNow: discountOnFirstNight,
        payNowAfterDiscount: firstNightAfterPct,
        totalAfterDiscount: totalAfterOnlyFirstNightDiscount,
      };
    }

    // fallback
    return {
      effectiveDiscountUsedNow: 0,
      payNowAfterDiscount: firstNightBefore,
      totalAfterDiscount: fullStayBefore,
    };
  }, [
    priceData,
    withJacuzzi,
    discountApplied,
    discountData,
    appliedEuroDiscount,
  ]);

  const {
    payNowAfterDiscount,
    totalAfterDiscount,
    effectiveDiscountUsedNow,
  } = computedBreakdown;

  // Fetch price (with or without jacuzzi)
  useEffect(() => {
    const fetchPrice = async () => {
      setLoadingPrice(true);
      setPriceError(null);

      try {
        const res = await fetch("/api/reservations/price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            houseId,
            startDate: startIso,
            endDate: endIso,
            guests,
            jacuzzi: withJacuzzi,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error("price error", data);
          setPriceError(
            data.error || "Could not calculate the price."
          );
          setPriceData(null);
          setLoadingPrice(false);
          return;
        }

        setPriceData(data);
      } catch (err: any) {
        console.error("price network error", err);
        setPriceError("Network error while calculating price.");
        setPriceData(null);
      } finally {
        setLoadingPrice(false);
      }
    };

    if (houseId && startIso && endIso && guests) {
      fetchPrice();
    } else {
      setLoadingPrice(false);
      setPriceError("Missing reservation parameters.");
    }
  }, [houseId, startIso, endIso, guests, withJacuzzi]);

  // Lookup discount code from backend
  const handleLookupDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountError(null);
    setDiscountLookupLoading(true);
    setDiscountApplied(false);
    setAppliedEuroDiscount(0);

    try {
      const res = await fetch(
        `/api/coupons/lookup?code=${encodeURIComponent(discountCode)}`
      );

      // Intentar leer JSON siempre (aunque sea error)
      const json = await res.json().catch(() => ({}));

      // Caso especial: 404 = no encontrado
      if (res.status === 404) {
        setDiscountError("No hemos encontrado ningún descuento con ese código.");
        setDiscountData(null);
        setDiscountLookupLoading(false);
        return;
      }

      // Otros errores (500, 400, etc.)
      if (!res.ok) {
        const errMsg =
          json?.error ||
          `Lookup failed: ${res.status}` ||
          "No hemos podido validar el código.";
        setDiscountError(errMsg);
        setDiscountData(null);
        setDiscountLookupLoading(false);
        return;
      }

      // ÉXITO → guardamos los datos (coupon o percent)
      setDiscountData(json);
    } catch (err: any) {
      setDiscountError(
        err?.message
          ? String(err.message)
          : "Error de red al comprobar el código."
      );
      setDiscountData(null);
    } finally {
      setDiscountLookupLoading(false);
    }
  };

  // Apply discount
  const handleApplyDiscount = () => {
    if (!priceData) {
      setDiscountError("Select dates first.");
      return;
    }
    if (!discountData) {
      setDiscountError("No discount loaded.");
      return;
    }

    setDiscountError(null);

    const firstNightBefore = priceData.first ?? 0;
    const totalBeforeNoJacuzzi = priceData.total ?? 0;
    const totalBeforeWithJacuzzi = priceData.grandTotal ?? 0;
    const totalBefore = withJacuzzi
      ? totalBeforeWithJacuzzi
      : totalBeforeNoJacuzzi;

    // ─────────────────────────────
    // 1) CUPÓN SALDO € (colección coupons)
    // ─────────────────────────────
    if (discountData.kind === "coupon" && discountData.coupon) {
      const remaining = Number(discountData.coupon.remaining ?? 0);
      if (!Number.isFinite(remaining) || remaining <= 0) {
        setDiscountError("Coupon has no remaining balance.");
        return;
      }

      // raw max we can try to use
      let rawToUse = Math.min(remaining, firstNightBefore, totalBefore);
      if (rawToUse <= 0) {
        setDiscountError("Nothing to apply.");
        return;
      }

      // enforce Stripe min rule on what's charged now
      const { used } = applyCreditToFirstNight(firstNightBefore, rawToUse);
      if (used <= 0) {
        setDiscountError(
          "Nothing to apply after Stripe minimum charge rule."
        );
        return;
      }

      // ✅ OK: aplicamos
      setAppliedEuroDiscount(used);
      setDiscountApplied(true);
      return;
    }

    // ─────────────────────────────
    // 2) DESCUENTO % (colección percentage_discounts)
    // ─────────────────────────────
    if (discountData.kind === "percent" && discountData.percentDoc) {
      const p = Number(discountData.percentDoc.percent ?? 0);
      const alreadyUsed = !!discountData.percentDoc.used;
      const expiresAt = discountData.percentDoc.expiresAt;
      const nowTs = Date.now();
      const expTs = expiresAt
        ? new Date(expiresAt + "T23:59:59").getTime()
        : null;

      // % inválido
      if (!Number.isFinite(p) || p <= 0) {
        setDiscountError("Invalid percentage discount.");
        return;
      }
      if (p > 100) {
        setDiscountError("Invalid percentage (>100%).");
        return;
      }

      // 🔴 NUEVA COMPROBACIÓN IMPORTANTE:
      // si ya está usado en Firestore -> lo bloqueamos
      if (alreadyUsed) {
        setDiscountError("This code was already used.");
        return;
      }

      // caducado
      if (expTs && expTs < nowTs) {
        setDiscountError("This code is expired.");
        return;
      }

      // calculo para mostrar "estás ahorrando X€ ahora"
      const approxUsed = (p / 100) * firstNightBefore;
      setAppliedEuroDiscount(approxUsed);

      // ✅ OK: aplicamos
      setDiscountApplied(true);
      return;
    }

    // ─────────────────────────────
    // 3) fallback si no coincide ningún tipo esperado
    // ─────────────────────────────
    setDiscountError("Unknown discount type.");
  };


  const handleClearDiscount = () => {
    setDiscountApplied(false);
    setAppliedEuroDiscount(0);
    setDiscountData(null);
    setDiscountError(null);
    setDiscountCode("");
  };

  // Go to Stripe checkout
  const handleGoToCheckout = async () => {
    if (!canSubmit || !priceData) return;

    try {
      // build discount payload for backend
      let discountPayload: any = null;

      if (discountApplied && discountData) {
        if (discountData.kind === "coupon" && discountData.coupon) {
          discountPayload = {
            kind: "coupon",
            id: discountData.coupon.id || "",
            code: discountData.coupon.code || "",
            // how many euros we're effectively applying now
            value: appliedEuroDiscount,
          };
        } else if (
          discountData.kind === "percent" &&
          discountData.percentDoc
        ) {
          discountPayload = {
            kind: "percent",
            id: discountData.percentDoc.id || "",
            code: discountData.percentDoc.code || "",
            value: Number(discountData.percentDoc.percent || 0), // %
          };
        }
      }

      const body: any = {
        houseId: houseId,
        start: startIso,
        end: endIso,
        guests,
        houseSlug: houseSlug || undefined,

        customer: {
          email,
          name: `${firstName} ${lastName}`.trim(),
          phone,
          arrivalTime: arrivalTime || undefined,
          comment: comment || undefined,
        },

        extras: {
          jacuzzi: withJacuzzi
            ? {
              enabled: true,
              price: priceData.jacuzziFee, // backend-computed
            }
            : { enabled: false },
        },

        discount: discountPayload || undefined,
      };

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("create-checkout-session failed", data);
        alert(data.error || "Error creating checkout session");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      alert("No checkout URL returned");
    } catch (err) {
      console.error("handleGoToCheckout error:", err);
      alert("Network error creating checkout session");
    }
  };

  const nights = priceData?.nights ?? 0;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 mt-12 md:py-12">
      <h1 className="text-3xl font-extrabold text-[var(--color-primary-dark)] mb-6 leading-tight">
        Reservation information
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN */}
        <section className="lg:col-span-2 space-y-8">
          {/* Guest details */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-[var(--color-primary-dark)] mb-4">
              Your details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First name */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  First name
                </label>
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your first name"
                />
              </div>

              {/* Last name */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Last name
                </label>
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Your last name"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                />
              </div>

              {/* Email confirm */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Confirm email
                </label>
                <input
                  type="email"
                  className={`border rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 ${email2 && !emailsMatch
                    ? "border-red-500 focus:ring-red-400"
                    : "border-gray-300 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                    }`}
                  value={email2}
                  onChange={(e) => setEmail2(e.target.value)}
                  placeholder="Repeat your email"
                />
                {email2 && !emailsMatch && (
                  <span className="text-xs text-red-600 mt-1">
                    Emails do not match
                  </span>
                )}
              </div>

              {/* Phone */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+34 ..."
                />
              </div>

              {/* Arrival time */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  Estimated arrival time
                </label>
                <input
                  type="time"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                />
              </div>
            </div>

            {/* Comment */}
            <div className="mt-4 flex flex-col">
              <label className="text-sm font-semibold text-gray-700 mb-1">
                Additional notes
              </label>
              <textarea
                className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Allergies, birthday surprise, etc."
              />
            </div>
          </div>

          {/* Extras */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-[var(--color-primary-dark)] mb-4">
              Extras
            </h2>

            <label className="flex items-start gap-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 rounded border-gray-400 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                checked={withJacuzzi}
                onChange={(e) => setWithJacuzzi(e.target.checked)}
              />
              <div className="flex-1">
                <div className="text-base font-semibold text-gray-900 flex flex-wrap items-baseline gap-2">
                  Private jacuzzi
                  {priceData && withJacuzzi && (
                    <span className="text-sm font-bold text-[var(--color-primary)]">
                      +{formatCurrency(jacuzziFeeShown)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 leading-relaxed">
                  65€ covers up to 2 guests. +10€/extra guest. One-time fee
                  for the stay.
                </div>
              </div>
            </label>
          </div>

          {/* Discount code */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-[var(--color-primary-dark)] mb-4">
              Discount / Coupon
            </h2>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch">
              <input
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                placeholder="Enter your code"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
              />

              <div className="flex gap-2">
                <button
                  onClick={handleLookupDiscount}
                  disabled={!discountCode || discountLookupLoading}
                  className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-60 min-w-[90px]"
                >
                  {discountLookupLoading ? "Checking…" : "Lookup"}
                </button>

                {discountData && (
                  <button
                    onClick={handleClearDiscount}
                    className="px-4 py-2 rounded-lg border text-sm font-semibold min-w-[90px]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {discountError && (
              <div className="text-sm text-red-600 mt-2">{discountError}</div>
            )}

            {discountData && (
              <div className="mt-4 text-sm text-gray-700 space-y-2">
                {discountData.kind === "coupon" && discountData.coupon && (
                  <>
                    <div className="font-medium">
                      Code: {discountData.coupon.code}{" "}
                      <span className="text-xs text-gray-500">
                        ({discountData.state})
                      </span>
                    </div>
                    <div>
                      Remaining balance:{" "}
                      <span className="font-semibold">
                        {formatCurrency(
                          Number(discountData.coupon.remaining ?? 0)
                        )}
                      </span>
                    </div>
                    {discountData.coupon.expiresAtIso && (
                      <div className="text-xs text-gray-500">
                        Expires: {discountData.coupon.expiresAtIso}
                      </div>
                    )}
                  </>
                )}

                {discountData.kind === "percent" &&
                  discountData.percentDoc && (
                    <>
                      <div className="font-medium">
                        Code: {discountData.percentDoc.code}{" "}
                        <span className="text-xs text-gray-500">
                          ({discountData.state})
                        </span>
                      </div>
                      <div>
                        Discount:{" "}
                        <span className="font-semibold">
                          {discountData.percentDoc.percent}% off (first
                          night only)
                        </span>
                      </div>
                      {discountData.percentDoc.expiresAt && (
                        <div className="text-xs text-gray-500">
                          Expires: {discountData.percentDoc.expiresAt}
                        </div>
                      )}
                      {discountData.percentDoc.used && (
                        <div className="text-xs text-red-600">
                          (Already used)
                        </div>
                      )}
                    </>
                  )}

                {!discountApplied ? (
                  <button
                    onClick={handleApplyDiscount}
                    className="mt-3 inline-block px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold"
                  >
                    Apply discount
                  </button>
                ) : (
                  <div className="mt-3 p-3 rounded-md bg-green-50 border border-green-200 text-sm">
                    Discount applied.
                    {appliedEuroDiscount > 0 && (
                      <>
                        {" "}
                        Using{" "}
                        <span className="font-semibold">
                          {formatCurrency(appliedEuroDiscount)}
                        </span>{" "}
                        now.
                      </>
                    )}
                    <button
                      onClick={() => {
                        setDiscountApplied(false);
                        setAppliedEuroDiscount(0);
                      }}
                      className="ml-3 underline"
                    >
                      Undo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: summary */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-xl p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-[var(--color-primary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Your stay
            </h2>

            <div className="text-sm text-gray-700 space-y-2">
              <div className="flex justify-between">
                <span>Check-in:</span>
                <span className="font-medium">{startPretty}</span>
              </div>

              <div className="flex justify-between">
                <span>Check-out:</span>
                <span className="font-medium">{endPretty}</span>
              </div>

              <div className="flex justify-between">
                <span>Nights:</span>
                <span className="font-medium">{nights}</span>
              </div>

              <div className="flex justify-between">
                <span>Guests:</span>
                <span className="font-medium">{guests}</span>
              </div>

              {withJacuzzi && priceData && (
                <div className="flex justify-between text-[var(--color-primary-dark)] font-semibold">
                  <span>Jacuzzi</span>
                  <span>+{formatCurrency(jacuzziFeeShown)}</span>
                </div>
              )}

              <hr className="my-4 border-gray-300" />

              {/* 1. Final total for the stay (after discount) */}
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>Total for the stay</span>
                <span>
                  {loadingPrice
                    ? "..."
                    : priceError
                      ? "—"
                      : totalAfterDiscount != null
                        ? formatCurrency(totalAfterDiscount)
                        : priceData
                          ? // fallback if for some reason we don't have totalAfterDiscount
                          formatCurrency(
                            withJacuzzi
                              ? priceData.grandTotal
                              : priceData.total
                          )
                          : "—"}
                </span>
              </div>

              {/* 2. Charge now (highlighted) */}
              <div className="mt-4 p-3 rounded-md bg-[var(--color-primary)]/10 border-l-4 border-[var(--color-primary)]">
                <div className="text-xs text-gray-600">Charge now</div>

                <div className="text-2xl font-bold text-[var(--color-primary)-dark]">
                  {loadingPrice
                    ? "..."
                    : priceError
                      ? "—"
                      : payNowAfterDiscount != null
                        ? formatCurrency(payNowAfterDiscount)
                        : priceData?.first != null
                          ? formatCurrency(priceData.first)
                          : "—"}
                </div>

                {/* mini breakdown if discount applied */}
                {discountApplied &&
                  discountData &&
                  !loadingPrice &&
                  !priceError &&
                  effectiveDiscountUsedNow > 0 && (
                    <div className="mt-2 text-xs text-gray-600 leading-relaxed">
                      {discountData.kind === "percent"
                        ? `A ${discountData.percentDoc?.percent}% discount has been applied to the first night.`
                        : `A coupon has been applied (${discountData.coupon?.code ||
                        ""}).`}{" "}
                      You pay now{" "}
                      {formatCurrency(payNowAfterDiscount ?? 0)}.
                    </div>
                  )}

                <div className="mt-2 text-[11px] text-gray-600 leading-relaxed">
                  The rest (and jacuzzi fee if selected) will be settled at
                  arrival.
                </div>
              </div>

              {/* pricing fetch error */}
              {priceError && (
                <p className="text-xs text-red-600 mt-2 italic">
                  {priceError}
                </p>
              )}
            </div>
          </div>

          <button
            disabled={!canSubmit}
            onClick={handleGoToCheckout}
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide text-sm shadow-lg transition-all duration-300 ${canSubmit
              ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] hover:shadow-xl transform hover:-translate-y-0.5"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
          >
            {canSubmit ? "Continue to payment" : "Fill your details"}
          </button>

          <button
            onClick={() => router.back()}
            className="block w-full text-center text-xs text-gray-500 underline hover:text-gray-700"
          >
            Go back
          </button>
        </aside>
      </div>
    </main>
  );
}
