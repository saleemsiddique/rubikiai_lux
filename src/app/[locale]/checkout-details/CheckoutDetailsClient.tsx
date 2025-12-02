"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from 'next-intl';

interface PriceResponse {
  total: number | null; // lodging + extra guests per night, no jacuzzi
  first: number | null; // first-night charge estimate (no jacuzzi)
  nights: number;
  extraGuests: number;
  includedBase: number;
  jacuzziFee: number; // jacuzzi surcharge (flat for whole stay)
  extrasTotal: number; // currently == jacuzziFee or 0
  grandTotal: number; // total stay with jacuzzi
  variable: boolean;
  perNightBreakdown: Array<{
    date: string;
    perUnit: Array<{ id: string; price: number | null }>;
    nightTotal: number;
  }>;
}


// ============================================
// 🔹 FUNCIONES DE PERSISTENCIA (FUERA DEL COMPONENTE)
// ============================================

const FORM_STORAGE_KEY = "checkout-form-data";

// Guardar con timestamp de expiración (1 hora)
function saveFormData(data: {
  firstName: string;
  lastName: string;
  email: string;
  email2: string;
  phone: string;
  arrivalTime: string;
  comment: string;
  withJacuzzi: boolean;
  jacuzziDays: number;
  discountCode: string;
}) {
  try {
    const toSave = {
      data,
      timestamp: Date.now(),
      expiresIn: 15 * 60 * 1000, // 1 hora
    };
    console.log("💾 Guardando datos:", data); // DEBUG
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error("❌ Error saving form data:", e);
  }
}

// Cargar y validar expiración
function loadFormData() {
  try {
    const saved = localStorage.getItem(FORM_STORAGE_KEY);
    if (!saved) {
      console.log("ℹ️ No hay datos guardados");
      return null;
    }

    const parsed = JSON.parse(saved);
    const now = Date.now();

    // Si ha expirado, eliminar y retornar null
    if (now - parsed.timestamp > parsed.expiresIn) {
      console.log("⏰ Datos expirados, eliminando...");
      localStorage.removeItem(FORM_STORAGE_KEY);
      return null;
    }

    console.log("✅ Datos cargados:", parsed.data);
    return parsed.data;
  } catch (e) {
    console.error("❌ Error loading form data:", e);
    return null;
  }
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
 * Use as much credit as possible on Reservation fee, but:
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
  const locale = useLocale();
  const t = useTranslations('checkoutDetails');
  const searchParams = useSearchParams();

  // Params from HousePage
  const houseId = searchParams.get("houseId") || ""; // could be single or "a__b"
  const houseSlug = searchParams.get("houseSlug") || "";
  const houseTitle = searchParams.get("houseTitle") || ""; // <-- NUEVO

  // Normalizar fechas a YYYY-MM-DD usando UTC para evitar problemas de timezone
  // Esto asegura que 2025-11-26T23:00:00.000Z siempre sea "2025-11-26"
  // ✅ DESPUÉS - Reemplaza la función completa por esta:
  const normalizeDate = (dateString: string): string => {
    if (!dateString) return "";
    try {
      // Si ya viene en formato YYYY-MM-DD, devolverlo tal cual
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }

      // Si viene como ISO string (con hora), extraer solo la fecha
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;

      // Usar getFullYear(), getMonth(), getDate() en lugar de UTC
      // para mantener consistencia con la fecha local seleccionada
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch {
      return dateString;
    }
  };

  const startIso = normalizeDate(searchParams.get("start") || "");
  const endIso = normalizeDate(searchParams.get("end") || "");
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
  const [jacuzziDays, setJacuzziDays] = useState(1); // días de jacuzzi solicitados

  /**
   * discountData can be:
   *  { kind: "coupon", coupon: {...}, state }
   *  { kind: "percent", percentDoc: {...}, state }
   *
   * We'll normalize name:
   *  kind: "coupon"  -> fixed euro balance
   *  kind: "percent" -> percentage off (applies ONLY to Reservation fee)
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
  const endPretty = endIso ? new Date(endIso).toLocaleDateString("en-GB") : "-";

  // Helper: contar cuántas unidades/casas se reservan (houseId puede ser "id" o "a__b")
  function countDualHouses(houseId: string) {
    if (!houseId) return 1;
    return houseId.split("__").filter(Boolean).length || 1;
  }

  const jacuzziFeeShown = useMemo(() => {
    if (!withJacuzzi || !priceData) return 0;

    const nights = priceData.nights || 0;
    const numHouses = countDualHouses(houseId); // detecta si es dual/multiple

    // Capacidad base de jacuzzi = 2 personas por unidad
    const baseCapacity = numHouses * 2;
    const extraGuestsForJacuzzi = Math.max(0, guests - baseCapacity);

    // Primer día: 65€ por cada casa + 10€ por cada huésped extra (total extras respecto a la capacidad combinada)
    const firstDayFee = numHouses * 65 + extraGuestsForJacuzzi * 10;

    // Días adicionales (si jacuzziDays > 1): 45€ por cada casa + 10€ por extra guest por día
    const additionalDays = Math.max(0, Math.min(jacuzziDays, nights) - 1);
    const additionalDaysFee =
      additionalDays * (numHouses * 45 + extraGuestsForJacuzzi * 10);

    return firstDayFee + additionalDaysFee;
  }, [withJacuzzi, jacuzziDays, guests, priceData, houseId]);

  /**
   * computedBreakdown:
   * - payNowAfterDiscount: what Stripe will try to charge now
   * - totalAfterDiscount: total cost of the stay after applying the discount
   *   (for percent, ONLY Reservation fee is discounted, so total goes down by that amount,
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

    const firstNightBefore = priceData.first ?? 0; // Reservation fee (no jacuzzi)
    const totalBeforeNoJacuzzi = priceData.total ?? 0;
    const fullStayBeforeWithJacuzzi = priceData.grandTotal ?? 0;

    // "Full stay" - ALWAYS use grandTotal because it already includes/excludes jacuzzi based on the API request
    const fullStayBefore = priceData.grandTotal ?? 0;

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

      // ✅ CORREGIDO: aplicar cupón al TOTAL COMPLETO (igual que admin/block)
      // amountApplied = cuánto del cupón se usa en total
      const amountApplied = Math.min(availableCredit, fullStayBefore);

      // De eso, cuánto se usa específicamente en la primera noche
      const usedOnFirstNight = Math.min(amountApplied, firstNightBefore);

      // Primera noche CON descuento
      const discountedFirst = Math.max(0, firstNightBefore - usedOnFirstNight);

      // Total CON descuento (resta TODA la cantidad aplicada, no solo lo usado en primera noche)
      const totalAfter = Math.max(0, fullStayBefore - amountApplied);

      // Aplicar regla de Stripe mínimo (0.50€) sobre lo que se cobra ahora
      const cents = toCents(discountedFirst);
      let payNow = discountedFirst;

      if (cents > 0 && cents < STRIPE_MIN_CENTS) {
        // Si queda entre 0.01€ y 0.49€, ajustar a 0.50€ o 0.00€
        const target50 = fromCents(STRIPE_MIN_CENTS); // 0.50€
        if (target50 <= firstNightBefore) {
          payNow = target50;
        } else {
          payNow = 0;
        }
      }

      return {
        effectiveDiscountUsedNow: amountApplied,
        payNowAfterDiscount: payNow,
        totalAfterDiscount: totalAfter,
      };
    }

    // ---- percent: discount applies ONLY to Reservation fee ----
    if (discountData.kind === "percent" && discountData.percentDoc) {
      const pct = Number(discountData.percentDoc.percent ?? 0) / 100;
      const pctClamped = Math.min(Math.max(pct, 0), 1); // [0,1]

      // discount only on Reservation fee
      const discountOnFirstNight = firstNightBefore * pctClamped;
      const firstNightAfterPct = firstNightBefore - discountOnFirstNight;

      // total after discount: subtract ONLY what we subtracted from Reservation fee
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
          totalAfterDiscount: Math.max(0, fullStayBefore - firstNightBefore),
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

  const { payNowAfterDiscount, totalAfterDiscount, effectiveDiscountUsedNow } =
    computedBreakdown;

  // ============================================
  // 🔹 CARGAR DATOS GUARDADOS AL MONTAR
  // ============================================
  useEffect(() => {
    const savedData = loadFormData();
    if (savedData) {
      console.log("🔄 Restaurando datos del formulario:", savedData);

      if (savedData.firstName) setFirstName(savedData.firstName);
      if (savedData.lastName) setLastName(savedData.lastName);
      if (savedData.email) setEmail(savedData.email);
      if (savedData.email2) setEmail2(savedData.email2);
      if (savedData.phone) setPhone(savedData.phone);
      if (savedData.arrivalTime) setArrivalTime(savedData.arrivalTime);
      if (savedData.comment) setComment(savedData.comment);

      // Cargar jacuzzi (el useEffect de fetch se triggereará automáticamente)
      if (typeof savedData.withJacuzzi === "boolean") setWithJacuzzi(savedData.withJacuzzi);
      if (savedData.jacuzziDays) setJacuzziDays(savedData.jacuzziDays);
      if (savedData.discountCode) setDiscountCode(savedData.discountCode);
    }
  }, []); // ← Array vacío = solo se ejecuta al montar
  
  // Fetch price (with or without jacuzzi AND jacuzzi days)
  useEffect(() => {
    let isActive = true; // Flag para prevenir actualizaciones de estado si el efecto se limpia

    const fetchPrice = async () => {
      setLoadingPrice(true);
      setPriceError(null);

      try {
        const res = await fetch(`/${locale}/api/reservations/price`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            houseId,
            startDate: startIso,
            endDate: endIso,
            guests,
            jacuzzi: withJacuzzi,
            jacuzziDays: withJacuzzi ? jacuzziDays : 0,
          }),
        });

        const data = await res.json();

        // Solo actualizar estado si este efecto todavía es activo
        if (!isActive) return;

        if (!res.ok) {
          console.error("price error", data);
          setPriceError(data.error || t('couldNotCalculatePrice'));
          setPriceData(null);
          setLoadingPrice(false);
          return;
        }

        console.log("✅ Price data received:", {
          houseId,
          withJacuzzi,
          jacuzziDays,
          priceData: data
        });
        setPriceData(data);
      } catch (err: any) {
        console.error("price network error", err);
        if (isActive) {
          setPriceError(t('networkErrorCalculatingPrice'));
          setPriceData(null);
        }
      } finally {
        if (isActive) {
          setLoadingPrice(false);
        }
      }
    };

    if (houseId && startIso && endIso && guests) {
      fetchPrice();
    } else {
      setLoadingPrice(false);
      setPriceError(t('missingReservationParameters'));
    }

    // Cleanup function: marcar como inactivo para ignorar respuestas obsoletas
    return () => {
      isActive = false;
    };
  }, [houseId, startIso, endIso, guests, withJacuzzi, jacuzziDays, locale, t]);

  // Guardar datos del formulario automáticamente cuando cambien
  useEffect(() => {
    const formData = {
      firstName,
      lastName,
      email,
      email2,
      phone,
      arrivalTime,
      comment,
      withJacuzzi,
      jacuzziDays,
      discountCode,
    };
    saveFormData(formData);
  }, [
    firstName,
    lastName,
    email,
    email2,
    phone,
    arrivalTime,
    comment,
    withJacuzzi,
    jacuzziDays,
    discountCode,
  ]);

  // Lookup discount code from backend
  const handleLookupDiscount = async () => {
    if (!discountCode.trim()) return;

    // Bloquear lookup si los cupones no están permitidos por importe inicial demasiado bajo
    if (!couponsAllowed) {
      setDiscountError(
        t('couponsNotAvailable', {
          current: formatCurrency(initialPayNow),
          minimum: formatCurrency(COUPON_MIN_EUROS)
        })
      );
      return;
    }

    setDiscountError(null);
    setDiscountLookupLoading(true);
    setDiscountApplied(false);
    setAppliedEuroDiscount(0);

    try {
      const res = await fetch(
        `/${locale}/api/coupons/lookup?code=${encodeURIComponent(discountCode)}`
      );

      // Intentar leer JSON siempre (aunque sea error)
      const json = await res.json().catch(() => ({}));

      // Caso especial: 404 = no encontrado
      if (res.status === 404) {
        setDiscountError(t('noDiscountFound'));
        setDiscountData(null);
        setDiscountLookupLoading(false);
        return;
      }

      // Otros errores (500, 400, etc.)
      if (!res.ok) {
        const errMsg = json?.error || t('couldNotValidateCode');
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
          : t('networkErrorCheckingCode')
      );
      setDiscountData(null);
    } finally {
      setDiscountLookupLoading(false);
    }
  };

  // Apply discount
  const handleApplyDiscount = () => {
    if (!priceData) {
      setDiscountError(t('selectDatesFirst'));
      return;
    }
    if (!discountData) {
      setDiscountError(t('noDiscountLoaded'));
      return;
    }

    setDiscountError(null);

    const firstNightBefore = priceData.first ?? 0;
    const totalBeforeNoJacuzzi = priceData.total ?? 0;
    const totalBeforeWithJacuzzi = priceData.grandTotal ?? 0;
    // ALWAYS use grandTotal because it already includes/excludes jacuzzi based on API request
    const totalBefore = priceData.grandTotal ?? 0;

    if (!couponsAllowed) {
      setDiscountError(
        t('couponsNotAvailable', {
          current: formatCurrency(initialPayNow),
          minimum: formatCurrency(COUPON_MIN_EUROS)
        })
      );
      return;
    }

    // ─────────────────────────────
    // 1) CUPÓN SALDO € (colección coupons)
    // ─────────────────────────────
    if (discountData.kind === "coupon" && discountData.coupon) {
      const remaining = Number(discountData.coupon.remaining ?? 0);
      if (!Number.isFinite(remaining) || remaining <= 0) {
        setDiscountError(t('couponNoBalance'));
        return;
      }

      // raw max we can try to use (don't limit to firstNightBefore here)
      const rawToUse = Math.min(remaining, totalBefore);
      if (rawToUse <= 0) {
        setDiscountError(t('nothingToApply'));
        return;
      }

      // enforce Stripe min rule on what's charged now
      const { used } = applyCreditToFirstNight(firstNightBefore, rawToUse);
      if (used <= 0) {
        setDiscountError(t('nothingToApplyStripe'));
        return;
      }

      // ✅ OK: aplicamos - guardar el crédito COMPLETO disponible, no solo lo usado en primera noche
      setAppliedEuroDiscount(rawToUse);
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
        setDiscountError(t('invalidPercentageDiscount'));
        return;
      }
      if (p > 100) {
        setDiscountError(t('invalidPercentageOver100'));
        return;
      }

      // 🔴 NUEVA COMPROBACIÓN IMPORTANTE:
      // si ya está usado en Firestore -> lo bloqueamos
      if (alreadyUsed) {
        setDiscountError(t('codeAlreadyUsed'));
        return;
      }

      // caducado
      if (expTs && expTs < nowTs) {
        setDiscountError(t('codeExpired'));
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
    setDiscountError(t('unknownDiscountType'));
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
        } else if (discountData.kind === "percent" && discountData.percentDoc) {
          discountPayload = {
            kind: "percent",
            id: discountData.percentDoc.id || "",
            code: discountData.percentDoc.code || "",
            value: Number(discountData.percentDoc.percent || 0), // %
          };
        }
      }

      // En handleMontonioCheckout, después de calcular computedBreakdown:
      const body: any = {
        houseId,
        houseSlug: houseSlug || undefined,
        start: startIso,
        end: endIso,
        guests,

        cancelUrl: window.location.href,

        // NUEVOS CAMPOS DE PRECIO SIMPLIFICADOS
        pricing: {
          payNow: payNowAfterDiscount ?? priceData.first ?? 0,
          totalStay: totalAfterDiscount ?? priceData.grandTotal ?? 0,
          // payAtArrival se calcula en backend: totalStay - payNow
        },

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
              days: jacuzziDays,
              price: jacuzziFeeShown,
            }
            : { enabled: false },
        },

        discount: discountPayload || undefined,
      };

      const res = await fetch(`/${locale}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("create-checkout-session failed", data);
        alert(data.error || t('errorCreatingCheckout'));
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      alert(t('noCheckoutUrl'));
    } catch (err) {
      console.error("handleGoToCheckout error:", err);
      alert(t('networkErrorCreatingCheckout'));
    }
  };

  // client-side (React / TSX) - handleMontonioCheckout
  const handleMontonioCheckout = async () => {
    if (!canSubmit || !priceData) return;

    try {
      // build discount payload for backend (same shape used by /api/create-checkout-session)
      let discountPayload: any = null;

      if (discountApplied && discountData) {
        if (discountData.kind === "coupon" && discountData.coupon) {
          discountPayload = {
            kind: "coupon",
            id: discountData.coupon.id || "",
            code: discountData.coupon.code || "",
            value: appliedEuroDiscount, // euros
          };
        } else if (discountData.kind === "percent" && discountData.percentDoc) {
          discountPayload = {
            kind: "percent",
            id: discountData.percentDoc.id || "",
            code: discountData.percentDoc.code || "",
            value: Number(discountData.percentDoc.percent || 0), // %
          };
        }
      }

      const body: any = {
        houseId,
        houseSlug: houseSlug || undefined,
        start: startIso,
        end: endIso,
        guests,

        cancelUrl: window.location.href,

        // NUEVOS CAMPOS DE PRECIO SIMPLIFICADOS
        pricing: {
          payNow: payNowAfterDiscount ?? priceData.first ?? 0,
          totalStay: totalAfterDiscount ?? priceData.grandTotal ?? 0,
          // payAtArrival se calcula en backend: totalStay - payNow
        },

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
              days: jacuzziDays,
              price: jacuzziFeeShown,
            }
            : { enabled: false },
        },
        discount: discountPayload || undefined,
      };

      const res = await fetch(`/${locale}/api/montonio/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("montonio checkout failed", data);
        alert(data.error || t('errorCreatingMontonio'));
        return;
      }

      if (data.url) {
        // redirigir a Montonio (pago de la Reservation fee)
        window.location.href = data.url;
        return;
      }

      if (data.successUrl) {
        // caso free order (Reservation fee <= 0)
        window.location.href = data.successUrl;
        return;
      }

      alert(t('noCheckoutUrl'));
    } catch (err) {
      console.error("handleMontonioCheckout error:", err);
      alert(t('networkErrorCreatingMontonio'));
    }
  };

  // fuera del return (en el mismo archivo, por ejemplo arriba del componente o en un util):
  function generateTimeOptions(startIso: string, endIso: string, stepMinutes = 15) {
    const times: string[] = [];
    const [sh, sm] = startIso.split(":").map(Number);
    const [eh, em] = endIso.split(":").map(Number);
    const start = new Date();
    start.setHours(sh, sm, 0, 0);
    const end = new Date();
    end.setHours(eh, em, 0, 0);

    for (let t = new Date(start); t <= end; t = new Date(t.getTime() + stepMinutes * 60_000)) {
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      times.push(`${hh}:${mm}`);
    }
    return times;
  }

  const nights = priceData?.nights ?? 0;

  // importe que se intentará cobrar ahora (según el cálculo de descuentos)
  const payNowAmount: number = Number(
    payNowAfterDiscount ?? priceData?.first ?? 0
  );

  // permitir pago por Montonio sólo si el formulario es válido y el importe a pagar ahora es > 0
  const canPayWithMontonio = canSubmit && payNowAmount > 0;

  // importe inicial mostrado por el backend para "charge now" ANTES de aplicar cupones/porcentajes
  // --- los cupones se permiten o no en función de ESTE valor ---
  const initialPayNow: number = Number(priceData?.first ?? 0);

  // permitir cupones/lookup sólo si el importe inicial a cobrar (sin descuentos) es al menos 10€
  const COUPON_MIN_EUROS = 10;
  const couponsAllowed = initialPayNow >= COUPON_MIN_EUROS;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 mt-18 md:py-12">
      <h1 className="text-3xl font-extrabold text-[var(--color-primary-dark)] mb-6 leading-tight">
        {t('title')}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN */}
        <section className="lg:col-span-2 space-y-8">
          {/* Guest details */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-[var(--color-primary-dark)] mb-4">
              {t('yourDetails')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First name */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  {t('firstName')}
                </label>
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t('firstNamePlaceholder')}
                />
              </div>

              {/* Last name */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  {t('lastName')}
                </label>
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t('lastNamePlaceholder')}
                />
              </div>

              {/* Email */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  {t('email')}
                </label>
                <input
                  type="email"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                />
              </div>

              {/* Email confirm */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  {t('confirmEmail')}
                </label>
                <input
                  type="email"
                  className={`border rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 ${email2 && !emailsMatch
                    ? "border-red-500 focus:ring-red-400"
                    : "border-gray-300 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                    }`}
                  value={email2}
                  onChange={(e) => setEmail2(e.target.value)}
                  placeholder={t('confirmEmailPlaceholder')}
                />
                {email2 && !emailsMatch && (
                  <span className="text-xs text-red-600 mt-1">
                    {t('emailsDoNotMatch')}
                  </span>
                )}
              </div>

              {/* Phone */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1">
                  {t('phone')}
                </label>
                <input
                  type="tel"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('phonePlaceholder')}
                />
              </div>

              {/* Arrival time (select) */}
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-1" htmlFor="arrivalTimeSelect">
                  {t('estimatedArrivalTime')}
                </label>

                <select
                  id="arrivalTimeSelect"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  aria-describedby="arrivalTimeHelp"
                >
                  <option value="">{t('selectTime')}</option>
                  {generateTimeOptions("16:00", "20:00", 15).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <div id="arrivalTimeHelp" className="text-xs text-gray-500 mt-1">
                  {t('arrivalTimeHelp')}
                </div>
              </div>
            </div>

            {/* Comment */}
            <div className="mt-4 flex flex-col">
              <label className="text-sm font-semibold text-gray-700 mb-1">
                {t('additionalNotes')}
              </label>
              <textarea
                className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('additionalNotesPlaceholder')}
              />
            </div>
          </div>

          {/* Extras */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-[var(--color-primary-dark)] mb-4">
              {t('extras')}
            </h2>

            <label className="flex items-start gap-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 rounded border-gray-400 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                checked={withJacuzzi}
                onChange={(e) => {
                  setWithJacuzzi(e.target.checked);
                  if (!e.target.checked) setJacuzziDays(1); // reset si se desmarca
                }}
              />
              <div className="flex-1">
                <div className="text-base font-semibold text-gray-900 flex flex-wrap items-baseline gap-2">
                  {t('privateJacuzzi')}

                  {/* Horario elegante al lado del título */}
                  <span className="flex items-center gap-1 text-[15px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6l4 2m6-2A10 10 0 11 2 12a10 10 0 0120 0z"
                      />
                    </svg>
                    {t('jacuzziAvailableTime')}
                  </span>

                  {priceData && withJacuzzi && (
                    <span className="text-sm font-bold text-[var(--color-primary)]">
                      +{formatCurrency(jacuzziFeeShown)}
                    </span>
                  )}
                </div>


                <div className="text-sm text-gray-600 leading-relaxed mb-3">
                  {t('jacuzziPricing')}
                </div>

                {withJacuzzi && priceData && priceData.nights > 0 && (
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">
                      {t('numberOfDays')}
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setJacuzziDays(Math.max(1, jacuzziDays - 1))
                        }
                        disabled={jacuzziDays <= 1}
                        className="w-8 h-8 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        −
                      </button>
                      <span className="w-12 text-center font-semibold text-lg">
                        {jacuzziDays}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setJacuzziDays(
                            Math.min(priceData.nights, jacuzziDays + 1)
                          )
                        }
                        disabled={jacuzziDays >= priceData.nights}
                        className="w-8 h-8 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs text-gray-500">
                      {t('maxNights', {
                        nights: priceData.nights,
                        nightsLabel: priceData.nights === 1 ? t('night') : t('nights')
                      })}
                    </span>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Discount code */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-[var(--color-primary-dark)] mb-4">
              {t('discountCoupon')}
            </h2>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch">
              <input
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                placeholder={t('enterCodePlaceholder')}
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
              />

              <div className="flex gap-2">
                <button
                  onClick={handleLookupDiscount}
                  disabled={!discountCode || discountLookupLoading}
                  className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-60 min-w-[90px]"
                >
                  {discountLookupLoading ? t('checking') : t('lookup')}
                </button>

                {discountData && (
                  <button
                    onClick={handleClearDiscount}
                    className="px-4 py-2 rounded-lg border text-sm font-semibold min-w-[90px]"
                  >
                    {t('clear')}
                  </button>
                )}
              </div>
            </div>

            {/* quick note when initial pay-now is below coupon threshold */}
            {initialPayNow < COUPON_MIN_EUROS && (
              <div className="mt-2 text-xs text-gray-500">
                {t('couponsRequireMinimum', {
                  minimum: formatCurrency(COUPON_MIN_EUROS),
                  current: formatCurrency(initialPayNow)
                })}
                <br />
                {t('percentageDiscountsStillApply')}
              </div>
            )}

            {discountError && (
              <div className="text-sm text-red-600 mt-2">{discountError}</div>
            )}

            {discountData && (
              <div className="mt-4 text-sm text-gray-700 space-y-2">
                {discountData.kind === "coupon" && discountData.coupon && (
                  <>
                    <div className="font-medium">
                      {t('code')} {discountData.coupon.code}{" "}
                      <span className="text-xs text-gray-500">
                        ({discountData.state})
                      </span>
                    </div>
                    <div>
                      {t('remainingBalance')}{" "}
                      <span className="font-semibold">
                        {formatCurrency(
                          Number(discountData.coupon.remaining ?? 0)
                        )}
                      </span>
                    </div>

                    {/* If coupon but initialPayNow below threshold -> disable Apply */}
                    {!discountApplied ? (
                      <div>
                        <button
                          onClick={handleApplyDiscount}
                          disabled={!couponsAllowed}
                          className={`mt-3 inline-block px-4 py-2 rounded-lg text-sm font-semibold ${couponsAllowed
                            ? "bg-[var(--color-primary)] text-white"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                        >
                          {t('applyDiscount')}
                        </button>

                        {!couponsAllowed && (
                          <div className="text-xs text-gray-500 mt-2">
                            {t('couponCannotBeApplied', {
                              current: formatCurrency(initialPayNow),
                              minimum: formatCurrency(COUPON_MIN_EUROS)
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 p-3 rounded-md bg-green-50 border border-green-200 text-sm">
                        {t('discountApplied')}
                        {appliedEuroDiscount > 0 && (
                          <>
                            {" "}
                            {t('using')}{" "}
                            <span className="font-semibold">
                              {formatCurrency(appliedEuroDiscount)}
                            </span>{" "}
                            {t('now')}
                          </>
                        )}
                        <button
                          onClick={() => {
                            setDiscountApplied(false);
                            setAppliedEuroDiscount(0);
                          }}
                          className="ml-3 underline"
                        >
                          {t('undo')}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {discountData.kind === "percent" && discountData.percentDoc && (
                  <>
                    <div className="font-medium">
                      {t('code')} {discountData.percentDoc.code}{" "}
                      <span className="text-xs text-gray-500">
                        ({discountData.state})
                      </span>
                    </div>
                    <div>
                      {t('discount')}{" "}
                      <span className="font-semibold">
                        {t('percentOff', { percent: discountData.percentDoc.percent })}
                      </span>
                    </div>
                    {discountData.percentDoc.expiresAt && (
                      <div className="text-xs text-gray-500">
                        {t('expires')} {discountData.percentDoc.expiresAt}
                      </div>
                    )}
                    {discountData.percentDoc.used && (
                      <div className="text-xs text-red-600">{t('alreadyUsed')}</div>
                    )}

                    {/* Percentage discounts can be applied regardless of initialPayNow */}
                    {!discountApplied ? (
                      <button
                        onClick={handleApplyDiscount}
                        className="mt-3 inline-block px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold"
                      >
                        {t('applyDiscount')}
                      </button>
                    ) : (
                      <div className="mt-3 p-3 rounded-md bg-green-50 border border-green-200 text-sm">
                        {t('discountApplied')}
                        {appliedEuroDiscount > 0 && (
                          <>
                            {" "}
                            {t('using')}{" "}
                            <span className="font-semibold">
                              {formatCurrency(appliedEuroDiscount)}
                            </span>{" "}
                            {t('now')}
                          </>
                        )}
                        <button
                          onClick={() => {
                            setDiscountApplied(false);
                            setAppliedEuroDiscount(0);
                          }}
                          className="ml-3 underline"
                        >
                          {t('undo')}
                        </button>
                      </div>
                    )}
                  </>
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
              {t('yourStay')}
            </h2>

            {houseTitle && (
              <div className="text-sm text-gray-600 mb-4">
                <span className="font-medium text-gray-800">{houseTitle}</span>
              </div>
            )}

            <div className="text-sm text-gray-700 space-y-2">
              <div className="flex justify-between">
                <span>{t('checkIn')}</span>
                <span className="font-medium">{startPretty}</span>
              </div>

              <div className="flex justify-between">
                <span>{t('checkOut')}</span>
                <span className="font-medium">{endPretty}</span>
              </div>

              <div className="flex justify-between">
                <span>{t('nightsLabel')}</span>
                <span className="font-medium">{nights}</span>
              </div>

              <div className="flex justify-between">
                <span>{t('guestsLabel')}</span>
                <span className="font-medium">{guests}</span>
              </div>

              {withJacuzzi && priceData && (
                <div className="flex justify-between text-[var(--color-primary-dark)] font-semibold">
                  <span>{t('jacuzzi')}</span>
                  <span>+{formatCurrency(jacuzziFeeShown)}</span>
                </div>
              )}

              <hr className="my-4 border-gray-300" />

              {/* 1. Final total for the stay (after discount) */}
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>{t('totalForStay')}</span>
                <span>
                  {loadingPrice
                    ? "..."
                    : priceError
                      ? "—"
                      : totalAfterDiscount != null
                        ? formatCurrency(totalAfterDiscount)
                        : priceData
                          ? // fallback if for some reason we don't have totalAfterDiscount
                          formatCurrency(priceData.grandTotal)
                          : "—"}
                </span>
              </div>

              {/* 2. Charge now (highlighted) */}
              <div className="mt-4 p-3 rounded-md bg-[var(--color-primary)]/10 border-l-4 border-[var(--color-primary)]">
                <div className="text-xs text-gray-600">{t('chargeNow')}</div>

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
                        ? t('percentDiscountAppliedMessage', { percent: discountData.percentDoc?.percent })
                        : t('couponAppliedMessage', { code: discountData.coupon?.code || "" })}{" "}
                      {t('youPayNow', { amount: formatCurrency(payNowAfterDiscount ?? 0) })}
                    </div>
                  )}

                <div className="mt-2 text-[11px] text-gray-600 leading-relaxed">
                  {t('restSettledAtArrival')}
                </div>
              </div>

              {/* pricing fetch error */}
              {priceError && (
                <p className="text-xs text-red-600 mt-2 italic">{priceError}</p>
              )}
            </div>
          </div>

          {payNowAmount === 0 ? (
            <button
              disabled={!canSubmit}
              onClick={handleGoToCheckout}
              className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide text-xl shadow-lg transition-all duration-300 ${canSubmit
                ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] hover:shadow-xl transform hover:-translate-y-0.5"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
            >
              {canSubmit ? t('continueToCheckout') : t('fillYourDetails')}
            </button>
          ) : (
            <>
              <button
                disabled={!canSubmit}
                onClick={handleGoToCheckout}
                className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide text-xl shadow-lg transition-all duration-300 ${canSubmit
                  ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] hover:shadow-xl transform hover:-translate-y-0.5"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {canSubmit ? t('payByCard') : t('fillYourDetails')}
              </button>
              <button
                onClick={handleMontonioCheckout}
                disabled={!canPayWithMontonio}
                aria-disabled={!canPayWithMontonio}
                className={`w-full py-4 rounded-xl font-bold uppercase tracking-wide text-sm shadow-lg transition-all duration-300 ${canPayWithMontonio
                  ? "bg-white text-[var(--color-primary)] border border-[var(--color-primary)] hover:shadow-md"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
              >
                {t('payWithBankTransfer')}
              </button>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
