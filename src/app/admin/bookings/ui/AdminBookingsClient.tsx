// app/admin/bookings/ui/AdminBookingsClient.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

type Reservation = {
    id: string;
    checkIn: string;
    checkOut: string;
    status?: string;
    houseId?: string;
    houseIds?: string[];

    // Customer info
    customer?: {
        name?: string;
        email?: string;
        phone?: string;
        userId?: string;
        arrivalTime?: string;
        comment?: string;
        [k: string]: any;
    };
    customerEmail?: string;
    email?: string;
    name?: string;
    phone?: string;
    userId?: string;
    arrivalTime?: string;
    comment?: string;

    // Pricing (simplified fields)
    payNow?: number;
    payAtArrival?: number;
    totalStay?: number;

    // Pricing (legacy - keep for compatibility)
    guests?: number;
    total?: number;
    grandTotal?: number;
    discountedTotal?: number;
    discountedGrandTotal?: number;
    firstNightCharge?: number;
    discountedFirst?: number;
    totalNightsOnly?: number;
    amountApplied?: number;
    jacuzziFee?: number;
    includedBase?: number;
    extraGuests?: number;
    currency?: string;

    // Jacuzzi (updated with days)
    jacuzzi?: {
        enabled: boolean;
        fee?: number;
        jacuzziFee?: number;
        days?: number;
    };

    // Coupon
    coupon?: any;
    code?: string;
    percentDiscount?: any;

    // Timestamps
    createdAt?: string | null;
    paidAt?: string | null;
    deductedAt?: string | null;
    updatedAt?: string | null;

    // Payment
    paidInFull?: boolean;
    stripeCustomerId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeSessionId?: string | null;

    // Metadata
    nights?: number;
    adminNote?: string;
    createdBy?: string;

    [k: string]: any;
};

const STATUSES = ["reserved", "admin", "complete", "canceled"] as const;
const CALENDAR_STATUSES = new Set(["reserved", "admin", "complete"]);

const HOUSE_OPTIONS = [
    { id: "L0TeFf2LmrWGAaAyS8NY", alias: "Ezero namelis" },
    { id: "PZwbfMYlSXj61uYYJutg", alias: "Šalia Elnių Aptvaro" },
    { id: "oDzv9346CdaAsok162sX", alias: "Elnių Panorama" },
];

const PROPERTY_NAME_MAP: Record<string, string> = {
    "L0TeFf2LmrWGAaAyS8NY": "Ezero Namelis",
    "PZwbfMYlSXj61uYYJutg": "Salia Elnių Aptvaro",
    "oDzv9346CdaAsok162sX": "Salia Elnių Panorama",
};

/* ---------- Date helpers (LOCAL) ---------- */
function pad2(n: number) {
    return n < 10 ? `0${n}` : `${n}`;
}
function ymdToISO(y: number, m1: number, d: number) {
    return `${y}-${pad2(m1 + 1)}-${pad2(d)}`;
}
function parseISOToLocalDate(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function toISOLocal(d: Date) {
    return ymdToISO(d.getFullYear(), d.getMonth(), d.getDate());
}
function toISO(d: Date) {
    return toISOLocal(d);
}
function addDaysISO(dt: string, n: number) {
    const d = parseISOToLocalDate(dt);
    d.setDate(d.getDate() + n);
    return toISOLocal(d);
}
function daysInMonth(year: number, monthIndexZero: number) {
    return new Date(year, monthIndexZero + 1, 0).getDate();
}
function isISODate(s: unknown): s is string {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isoCmp(a: string, b: string) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}
function isoLt(a: string, b: string) {
    return isoCmp(a, b) < 0;
}

/* ---------- Network helpers ---------- */
async function readError(res: Response) {
    const text = await res.text();
    try {
        const json = JSON.parse(text);
        return json?.error || JSON.stringify(json);
    } catch {
        return text || `${res.status} ${res.statusText}`;
    }
}
function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit = {},
    ms = 20000
) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    const merged: RequestInit = {
        ...init,
        signal: controller.signal,
        cache: "no-store" as RequestCache,
    };
    return fetch(input, merged).finally(() => clearTimeout(id));
}

/* ---------------- Price Summary Component ---------------- */
function PriceSummaryBlock({ 
  houseId, 
  startDate, 
  endDate, 
  guests, 
  jacuzziEnabled, 
  jacuzziDays,
  discountApplied,
  discountData,
  appliedDiscount
}: { 
  houseId: string; 
  startDate: string; 
  endDate: string; 
  guests: number;
  jacuzziEnabled: boolean;
  jacuzziDays: number;
  discountApplied: boolean;
  discountData: any;
  appliedDiscount: number;
}) {
  const [priceData, setPriceData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      // 🔍 Validar que tenemos todos los datos necesarios
      if (!houseId || !startDate || !endDate) {
        console.log('⏸️ [PriceSummary] Missing required data:', { houseId, startDate, endDate });
        setPriceData(null);
        return;
      }

      // 🔍 Validar formato de fechas (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        console.error('❌ [PriceSummary] Invalid date format:', { startDate, endDate });
        setError('Invalid date format. Expected YYYY-MM-DD');
        return;
      }

      // 🔍 Validar que startDate < endDate
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        console.error('❌ [PriceSummary] Start date must be before end date:', { startDate, endDate });
        setError('Check-out date must be after check-in date');
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const body: any = {
          houseId,
          startDate,
          endDate,
          guests,
        };

        if (jacuzziEnabled && jacuzziDays > 0) {
          body.jacuzzi = true;
          body.jacuzziDays = jacuzziDays;
        }

        console.log('🔵 [PriceSummary] Calling price API with:', body);

        const res = await fetch('/api/reservations/price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        console.log('🔵 [PriceSummary] Response status:', res.status);

        if (!res.ok) {
          const errorText = await res.text();
          console.error('🔴 [PriceSummary] Error response:', errorText);
          throw new Error(`Price fetch failed: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log('✅ [PriceSummary] Price data received:', data);
        setPriceData(data);
      } catch (err: any) {
        console.error('🔴 [PriceSummary] Fetch error:', err);
        setError(err?.message || 'Failed to fetch price');
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
  }, [houseId, startDate, endDate, guests, jacuzziEnabled, jacuzziDays]);

  if (loading) {
    return (
      <div className="border-t pt-3 mt-2 text-xs text-neutral-600">
        Loading price summary...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t pt-3 mt-2">
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-700">
          <span className="font-semibold">Price calculation error:</span> {error}
        </div>
      </div>
    );
  }

  if (!priceData) return null;

  // Calculate discount amounts
  let discountedFirst = priceData.first || 0;
  let discountedGrandTotal = priceData.grandTotal || 0;
  let discountAmount = 0;

  if (discountApplied && discountData) {
    if (discountData.kind === 'coupon') {
      // Coupon: fixed euro amount off first night
      discountAmount = Math.min(appliedDiscount, priceData.first || 0, priceData.grandTotal || 0);
      discountedFirst = Math.max(0, (priceData.first || 0) - discountAmount);
      discountedGrandTotal = Math.max(0, (priceData.grandTotal || 0) - discountAmount);
    } else if (discountData.kind === 'percent') {
      // Percentage: applies only to first night
      const percentValue = appliedDiscount;
      discountAmount = ((percentValue / 100) * (priceData.first || 0));
      discountedFirst = Math.max(0, (priceData.first || 0) - discountAmount);
      discountedGrandTotal = Math.max(0, (priceData.grandTotal || 0) - discountAmount);
    }
  }

  const nights = priceData.nights || 0;
  const extraGuests = priceData.extraGuests || 0;

  return (
    <div className="border-t pt-3 mt-2">
      <div className="text-xs font-semibold text-neutral-700 mb-2">
        Reservation Summary
      </div>
      <div className="bg-gray-50 rounded-md p-3 text-xs space-y-2">
        <div className="flex justify-between">
          <span className="text-neutral-600">Accommodation ({nights} night{nights > 1 ? 's' : ''})</span>
          <span className="font-medium">€{(priceData.total || 0).toFixed(2)}</span>
        </div>

        {extraGuests > 0 && (
          <div className="flex justify-between text-neutral-600">
            <span>Extra guests ({extraGuests})</span>
            <span>Included in total</span>
          </div>
        )}

        {jacuzziEnabled && (priceData.jacuzziFee || 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-neutral-600">Jacuzzi ({jacuzziDays} day{jacuzziDays > 1 ? 's' : ''})</span>
            <span className="font-medium">€{(priceData.jacuzziFee || 0).toFixed(2)}</span>
          </div>
        )}

        <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
          <span>Total</span>
          <span>€{(priceData.grandTotal || 0).toFixed(2)}</span>
        </div>

        {discountApplied && discountAmount > 0 && (
          <>
            <div className="flex justify-between text-green-600">
              <span>Discount applied</span>
              <span>-€{discountAmount.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold text-[var(--color-primary)]">
              <span>Total after discount</span>
              <span>€{discountedGrandTotal.toFixed(2)}</span>
            </div>
          </>
        )}

        <div className="border-t border-gray-300 pt-2 mt-2">
          <div className="flex justify-between text-[var(--color-primary-dark)]">
            <span>Reservation fee (pay now)</span>
            <span className="font-bold">€{discountedFirst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-neutral-600 mt-1">
            <span>Pay at arrival</span>
            <span>€{Math.max(0, discountedGrandTotal - discountedFirst).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminBookingsClient() {
    const router = useRouter();

    // Filters
    const [statusFilter, setStatusFilter] = useState<string[]>([
        "reserved",
        "admin",
    ]);
    const [rangeStart, setRangeStart] = useState<string>(toISO(new Date()));
    const [rangeEnd, setRangeEnd] = useState<string>(
        addDaysISO(toISO(new Date()), 60)
    );
    const [houseId, setHouseId] = useState<string>("");

    const [rows, setRows] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Calendar
    const today = new Date();
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const firstDayOfMonthISO = toISO(new Date(calYear, calMonth, 1));
    const lastDayOfMonthISO = toISO(
        new Date(calYear, calMonth, daysInMonth(calYear, calMonth))
    );

    const monthStart = firstDayOfMonthISO;
    const monthEndExclusive = addDaysISO(lastDayOfMonthISO, 1);

    const [occReservations, setOccReservations] = useState<Reservation[]>([]);
    const [occErr, setOccErr] = useState<string | null>(null);
    const [occLoading, setOccLoading] = useState(false);

    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    // Block form
    const [blockStart, setBlockStart] = useState<string>(firstDayOfMonthISO);
    const [blockEnd, setBlockEnd] = useState<string>(
        addDaysISO(firstDayOfMonthISO, 1)
    );
    const [blockHouseId, setBlockHouseId] = useState<string>("");
    const [blockGuests, setBlockGuests] = useState<number>(2);

    // Customer info for blocking
    const [blockCustomerName, setBlockCustomerName] = useState<string>("");
    const [blockCustomerEmail, setBlockCustomerEmail] = useState<string>("");
    const [blockCustomerPhone, setBlockCustomerPhone] = useState<string>("");
    const [blockArrivalTime, setBlockArrivalTime] = useState<string>("");
    const [blockComment, setBlockComment] = useState<string>("");

    // Jacuzzi options
    const [blockWithJacuzzi, setBlockWithJacuzzi] = useState<boolean>(false);
    const [blockJacuzziDays, setBlockJacuzziDays] = useState<number>(1);

    // Discount options
    const [blockDiscountCode, setBlockDiscountCode] = useState<string>("");
    const [blockDiscountData, setBlockDiscountData] = useState<any | null>(null);
    const [blockDiscountLookupLoading, setBlockDiscountLookupLoading] = useState(false);
    const [blockDiscountError, setBlockDiscountError] = useState<string | null>(null);
    const [blockDiscountApplied, setBlockDiscountApplied] = useState(false);
    const [blockAppliedEuroDiscount, setBlockAppliedEuroDiscount] = useState<number>(0);

    const [blockBusy, setBlockBusy] = useState(false);
    const [blockMsg, setBlockMsg] = useState<string | null>(null);

    /* ---------- Fetch list ---------- */
    const fetchList = async () => {
        setLoading(true);
        setErr(null);
        try {
            const params = new URLSearchParams();
            if (statusFilter.length)
                params.set("status", statusFilter.join(","));
            if (rangeStart) params.set("start", rangeStart);
            if (rangeEnd) params.set("end", rangeEnd);
            if (houseId) params.set("houseId", houseId);
            params.set("limit", "1000");

            console.time("[UI] list fetch");
            const res = await fetchWithTimeout(
                `/api/admin/reservations/list?${params.toString()}`,
                {},
                20000
            );
            if (!res.ok) {
                const detail = await readError(res);
                throw new Error(detail);
            }
            const json = await res.json();
            console.timeEnd("[UI] list fetch");
            setRows(json.results || []);
        } catch (e: any) {
            console.error("[UI] list error:", e);
            setErr(e?.message || "List error");
        } finally {
            setLoading(false);
        }
    };

    /* ---------- Fetch occupancy ---------- */
    type DayCell = {
        key: string;
        iso?: string;
        dayNum?: number;
        isCurrentMonth: boolean;
    };

    const calendarCells = useMemo<DayCell[]>(() => {
        const firstDayDate = new Date(calYear, calMonth, 1);
        const firstWeekday = (firstDayDate.getDay() + 6) % 7;
        const daysCount = daysInMonth(calYear, calMonth);
        const cells: DayCell[] = [];

        for (let i = 0; i < firstWeekday; i++) {
            cells.push({ key: `p-${i}`, isCurrentMonth: false });
        }

        for (let d = 1; d <= daysCount; d++) {
            const iso = toISO(new Date(calYear, calMonth, d));
            cells.push({
                key: `d-${iso}`,
                iso,
                dayNum: d,
                isCurrentMonth: true,
            });
        }

        const total = cells.length;
        const rows = Math.ceil(total / 7);
        const trailing = rows * 7 - total;
        for (let i = 0; i < trailing; i++) {
            cells.push({ key: `s-${i}`, isCurrentMonth: false });
        }

        return cells;
    }, [calYear, calMonth]);

    const fetchMonthOccupancy = async () => {
        setOccLoading(true);
        setOccErr(null);
        try {
            const params = new URLSearchParams();
            params.set("start", monthStart);
            params.set("end", monthEndExclusive);
            if (houseId) params.set("houseId", houseId);

            console.time("[UI] occupancy fetch");
            const res = await fetchWithTimeout(
                `/api/admin/reservations/occupancy?${params.toString()}`,
                {},
                20000
            );
            if (!res.ok) {
                const detail = await readError(res);
                throw new Error(detail);
            }
            const json = await res.json();
            console.timeEnd("[UI] occupancy fetch");
            setOccReservations(json.results || []);
        } catch (e: any) {
            console.error("[UI] occupancy error:", e);
            setOccErr(e?.message || "Occupancy error");
            setOccReservations([]);
        } finally {
            setOccLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchMonthOccupancy();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calYear, calMonth, houseId]);

    /* ---------- Day map ---------- */
    const dayMap = useMemo(() => {
        const m = new Map<string, Reservation[]>();
        const MAX_DAYS_SAFE = 62;

        for (const r of occReservations) {
            const st = String(r.status || "").toLowerCase();
            if (!CALENDAR_STATUSES.has(st as any)) continue;

            const ci = r.checkIn;
            const co = r.checkOut;
            if (!isISODate(ci) || !isISODate(co)) continue;

            const startUse = isoCmp(ci, monthStart) < 0 ? monthStart : ci;
            const endUse =
                isoCmp(co, monthEndExclusive) > 0 ? monthEndExclusive : co;

            const endLoopExclusive =
                isoCmp(addDaysISO(endUse, 1), monthEndExclusive) < 0
                    ? addDaysISO(endUse, 1)
                    : monthEndExclusive;

            if (!isoLt(startUse, endLoopExclusive)) continue;

            let d = startUse;
            let guard = 0;
            while (isoLt(d, endLoopExclusive) && guard < MAX_DAYS_SAFE) {
                const arr = m.get(d) || [];
                if (!arr.some((x) => x.id === r.id)) {
                    (r as any).__isCheckInDay = d === r.checkIn;
                    (r as any).__isCheckOutDay = d === r.checkOut;
                    arr.push(r);
                    m.set(d, arr);
                }
                d = addDaysISO(d, 1);
                guard++;
            }
            if (guard >= MAX_DAYS_SAFE) {
                console.warn(
                    "[calendar] Reservation truncated for safety:",
                    r.id,
                    ci,
                    "→",
                    co
                );
            }
        }
        return m;
    }, [occReservations, monthStart, monthEndExclusive]);

    const BLOCKING_STATES = new Set(["reserved", "complete", "admin"]);

    function rangesOverlap(
        aStart: string,
        aEnd: string,
        bStart: string,
        bEnd: string
    ) {
        return aStart < bEnd && bStart < aEnd;
    }

    async function checkBlockConflicts(
        startISO: string,
        endISO: string,
        houseId: string
    ) {
        const params = new URLSearchParams();
        params.set("start", startISO);
        params.set("end", endISO);
        if (houseId) params.set("houseId", houseId);

        const res = await fetchWithTimeout(
            `/api/admin/reservations/occupancy?${params.toString()}`,
            {},
            20000
        );
        if (!res.ok) {
            const detail = await readError(res);
            throw new Error(detail || "Could not check occupancy");
        }
        const json = await res.json();
        const list: Reservation[] = json.results || [];

        const blockers = list.filter((r) =>
            BLOCKING_STATES.has(String(r.status || "").toLowerCase() as any)
        );

        return blockers.some((r) =>
            rangesOverlap(startISO, endISO, r.checkIn, r.checkOut)
        );
    }

    // Calculate nights between two dates
    const calculateNights = (start: string, end: string): number => {
        if (!isISODate(start) || !isISODate(end)) return 0;
        const startDate = parseISOToLocalDate(start);
        const endDate = parseISOToLocalDate(end);
        const ms = endDate.getTime() - startDate.getTime();
        return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
    };

    /* ---------- Discount Handlers ---------- */
    const handleLookupDiscount = async () => {
        if (!blockDiscountCode.trim()) return;

        setBlockDiscountError(null);
        setBlockDiscountLookupLoading(true);
        setBlockDiscountApplied(false);
        setBlockAppliedEuroDiscount(0);

        try {
            const res = await fetchWithTimeout(
                `/api/coupons/lookup?code=${encodeURIComponent(blockDiscountCode)}`,
                {},
                20000
            );

            const json = await res.json().catch(() => ({}));

            if (res.status === 404) {
                setBlockDiscountError("No discount found with that code.");
                setBlockDiscountData(null);
                setBlockDiscountLookupLoading(false);
                return;
            }

            if (!res.ok) {
                const errMsg = json?.error || `Lookup failed: ${res.status}` || "Could not validate code.";
                setBlockDiscountError(errMsg);
                setBlockDiscountData(null);
                setBlockDiscountLookupLoading(false);
                return;
            }

            setBlockDiscountData(json);
        } catch (err: any) {
            setBlockDiscountError(err?.message ? String(err.message) : "Network error checking code.");
            setBlockDiscountData(null);
        } finally {
            setBlockDiscountLookupLoading(false);
        }
    };

    const handleApplyDiscount = () => {
        if (!blockDiscountData) {
            setBlockDiscountError("No discount loaded.");
            return;
        }

        setBlockDiscountError(null);

        // COUPON: fixed euro amount
        if (blockDiscountData.kind === "coupon" && blockDiscountData.coupon) {
            const remaining = Number(blockDiscountData.coupon.remaining ?? 0);
            if (!Number.isFinite(remaining) || remaining <= 0) {
                setBlockDiscountError("Coupon has no remaining balance.");
                return;
            }

            // For admin blocks, we just mark the amount to apply
            setBlockAppliedEuroDiscount(remaining);
            setBlockDiscountApplied(true);
            return;
        }

        // PERCENTAGE: applies only to first night
        if (blockDiscountData.kind === "percent" && blockDiscountData.percentDoc) {
            const p = Number(blockDiscountData.percentDoc.percent ?? 0);
            const alreadyUsed = !!blockDiscountData.percentDoc.used;
            const expiresAt = blockDiscountData.percentDoc.expiresAt;
            const nowTs = Date.now();
            const expTs = expiresAt ? new Date(expiresAt + "T23:59:59").getTime() : null;

            if (!Number.isFinite(p) || p <= 0) {
                setBlockDiscountError("Invalid percentage discount.");
                return;
            }
            if (p > 100) {
                setBlockDiscountError("Invalid percentage (>100%).");
                return;
            }
            if (alreadyUsed) {
                setBlockDiscountError("This code was already used.");
                return;
            }
            if (expTs && expTs < nowTs) {
                setBlockDiscountError("This code is expired.");
                return;
            }

            // For percentage, we store the percentage value
            setBlockAppliedEuroDiscount(p);
            setBlockDiscountApplied(true);
            return;
        }

        setBlockDiscountError("Unknown discount type.");
    };

    const handleClearDiscount = () => {
        setBlockDiscountApplied(false);
        setBlockAppliedEuroDiscount(0);
        setBlockDiscountData(null);
        setBlockDiscountError(null);
        setBlockDiscountCode("");
    };

    /* ---------- Actions ---------- */
    const updateStatus = async (
        id: string,
        status: string,
        paidInFull?: boolean
    ) => {
        try {
            const body: any = { status };
            if (paidInFull) body.paidInFull = true;

            const res = await fetchWithTimeout(
                `/api/admin/reservations/${encodeURIComponent(id)}/status`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                },
                20000
            );

            if (!res.ok) {
                const detail = await readError(res);
                throw new Error(detail);
            }

            await fetchList();
            await fetchMonthOccupancy();
        } catch (e: any) {
            alert(e?.message || "Update error");
        }
    };

    // Create block function with jacuzzi days and discount support
    const createBlock = async () => {
        setBlockBusy(true);
        setBlockMsg(null);
        try {
            if (!blockHouseId) {
                throw new Error("You must select a House to block.");
            }
            if (
                !(isISODate(blockStart) && isISODate(blockEnd)) ||
                !(blockStart < blockEnd)
            ) {
                throw new Error("Invalid date range.");
            }

            const todayISO = toISO(new Date());
            if (blockEnd <= todayISO) {
                throw new Error("You cannot block dates in the past.");
            }

            // Validate required customer fields
            if (!blockCustomerName.trim()) {
                throw new Error("Customer name is required.");
            }
            if (!blockCustomerEmail.trim()) {
                throw new Error("Customer email is required.");
            }

            const hasConflict = await checkBlockConflicts(
                blockStart,
                blockEnd,
                blockHouseId
            );
            if (hasConflict) {
                throw new Error(
                    "The selected dates overlap with an existing reservation (reserved / complete / admin)."
                );
            }

            // Build customer object (now required)
            const customer: any = {
                name: blockCustomerName.trim(),
                email: blockCustomerEmail.trim(),
            };

            if (blockCustomerPhone.trim()) {
                customer.phone = blockCustomerPhone.trim();
            }

            const payload: any = {
                checkIn: blockStart,
                checkOut: blockEnd,
                houseId: blockHouseId,
                guests: blockGuests,
                customer: customer,
            };

            if (blockArrivalTime.trim()) {
                payload.arrivalTime = blockArrivalTime.trim();
            }
            if (blockComment.trim()) {
                payload.comment = blockComment.trim();
            }

            // Add jacuzzi info if enabled
            if (blockWithJacuzzi) {
                payload.jacuzzi = {
                    enabled: true,
                    days: blockJacuzziDays,
                };
            }

            // Add discount info if applied
            if (blockDiscountApplied && blockDiscountData) {
                if (blockDiscountData.kind === "coupon" && blockDiscountData.coupon) {
                    payload.discount = {
                        code: blockDiscountData.coupon.code || blockDiscountCode.trim(),
                        amount: blockAppliedEuroDiscount,
                        type: "coupon",
                    };
                } else if (blockDiscountData.kind === "percent" && blockDiscountData.percentDoc) {
                    payload.discount = {
                        code: blockDiscountData.percentDoc.code || blockDiscountCode.trim(),
                        amount: blockAppliedEuroDiscount, // This is the percentage value
                        type: "percent",
                    };
                }
            }

            const res = await fetchWithTimeout(
                "/api/admin/reservations/block",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                },
                20000
            );

            if (!res.ok) {
                const detail = await readError(res);
                throw new Error(detail);
            }

            setBlockMsg("Dates blocked successfully.");
            
            // Reset form
            setBlockCustomerName("");
            setBlockCustomerEmail("");
            setBlockCustomerPhone("");
            setBlockArrivalTime("");
            setBlockComment("");
            setBlockWithJacuzzi(false);
            setBlockJacuzziDays(1);
            setBlockDiscountCode("");
            setBlockDiscountData(null);
            setBlockDiscountApplied(false);
            setBlockAppliedEuroDiscount(0);
            setBlockDiscountError(null);

            await fetchList();
            await fetchMonthOccupancy();
        } catch (e: any) {
            setBlockMsg(`Error: ${e?.message || e}`);
        } finally {
            setBlockBusy(false);
        }
    };

    const nights = calculateNights(blockStart, blockEnd);

    /* ---------- UI ---------- */
    return (
        <main className="min-h-screen pt-24 bg-[var(--color-background-main)]">
            <section className="max-w-6xl mx-auto px-6 py-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button
                            type="button"
                            onClick={() => {
                                if (
                                    typeof window !== "undefined" &&
                                    window.history.length > 1
                                ) {
                                    router.back();
                                } else {
                                    router.push("/admin/menu");
                                }
                            }}
                            className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                            aria-label="Back"
                            title="Back"
                        >
                            <span aria-hidden>←</span>
                            <span>Back</span>
                        </button>

                        <h1 className="text-xl md:text-2xl font-bold text-[var(--color-primary-dark)]">
                            Reservations
                        </h1>
                    </div>

                    <button
                        onClick={fetchList}
                        disabled={loading}
                        className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
                    >
                        {loading ? "Loading…" : "Refresh"}
                    </button>
                </div>

                {/* Filters */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 bg-white border rounded-xl p-4">
                    <div className="flex flex-col">
                        <label className="text-xs text-neutral-600">
                            Status
                        </label>
                        <select
                            multiple
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(
                                    Array.from(e.target.selectedOptions).map(
                                        (o) => o.value
                                    )
                                )
                            }
                            className="mt-1 border rounded-md p-2 h-[96px]"
                        >
                            {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                        <div className="text-[11px] text-neutral-500 mt-1">
                            Ctrl/Cmd for multi-selection
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-neutral-600">
                            From
                        </label>
                        <input
                            type="date"
                            value={rangeStart}
                            onChange={(e) => setRangeStart(e.target.value)}
                            className="mt-1 border rounded-md p-2"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-neutral-600">
                            To
                        </label>
                        <input
                            type="date"
                            value={rangeEnd}
                            onChange={(e) => setRangeEnd(e.target.value)}
                            className="mt-1 border rounded-md p-2"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-neutral-600">
                            House
                        </label>
                        <select
                            value={houseId}
                            onChange={(e) => setHouseId(e.target.value)}
                            className="mt-1 border rounded-md p-2"
                        >
                            <option value="">(All)</option>
                            {HOUSE_OPTIONS.map((h) => (
                                <option key={h.id} value={h.id}>
                                    {h.alias}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-4 flex gap-2">
                        <button
                            onClick={fetchList}
                            className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95"
                        >
                            Search
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="mt-6 bg-white border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b text-sm font-semibold">
                        Results
                    </div>
                    {loading ? (
                        <div className="p-4 text-sm text-neutral-600">
                            Loading…
                        </div>
                    ) : err ? (
                        <div className="p-4 text-sm text-red-600 whitespace-pre-wrap">
                            {err}
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="p-4 text-sm text-neutral-600">
                            No results
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-neutral-50 text-neutral-700">
                                    <tr>
                                        <th className="px-3 py-2 text-left">
                                            Dates
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            Status
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            House
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            Customer
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            Email
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            Guests
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                            Total
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                            Paid
                                        </th>
                                        <th className="px-3 py-2">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => {
                                        const customerName = r.name || r.customer?.name || "—";
                                        const customerEmail = r.customerEmail || r.email || r.customer?.email || "—";

                                        const totalStay = r.totalStay ?? r.discountedGrandTotal ?? r.discountedTotal ?? r.grandTotal ?? r.total ?? 0;
                                        const payNow = r.payNow ?? r.discountedFirst ?? r.firstNightCharge ?? 0;
                                        const jacuzziDays = r.jacuzzi?.days ?? 0;

                                        return (
                                            <tr key={r.id} className="border-t">
                                                <td className="px-3 py-2">
                                                    {r.checkIn} → {r.checkOut}{" "}
                                                    <span className="text-[10px] text-neutral-500">
                                                        ({r.nights ?? "?"}n)
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]">
                                                        {r.status}
                                                    </span>
                                                    {r.paidInFull && (
                                                        <span className="ml-1 text-[10px] text-green-600">
                                                            ✓ Paid
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {r.houseId ??
                                                        r.houseIds?.join(",")}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {customerName}
                                                    {r.phone || r.customer?.phone ? (
                                                        <div className="text-[10px] text-neutral-500">
                                                            {r.phone || r.customer?.phone}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {customerEmail}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {r.guests ?? "—"}
                                                    {r.extraGuests ? (
                                                        <span className="text-[10px] text-neutral-500">
                                                            {" "}(+{r.extraGuests})
                                                        </span>
                                                    ) : null}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {totalStay.toFixed(2)}€
                                                    {r.jacuzzi?.enabled && (
                                                        <div className="text-[10px] text-neutral-500">
                                                            +{r.jacuzziFee ?? 0}€ jacuzzi
                                                            {jacuzziDays > 0 && ` (${jacuzziDays}d)`}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {payNow.toFixed(2)}€
                                                    {r.amountApplied ? (
                                                        <div className="text-[10px] text-green-600">
                                                            -{r.amountApplied}€
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap gap-2 justify-end">
                                                        <select
                                                            className="border rounded-md p-1 text-xs"
                                                            value={r.status}
                                                            onChange={async (
                                                                e
                                                            ) => {
                                                                try {
                                                                    await updateStatus(
                                                                        r.id,
                                                                        e.target
                                                                            .value
                                                                    );
                                                                } catch (
                                                                er: any
                                                                ) {
                                                                    alert(
                                                                        er?.message ||
                                                                        "Error"
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            {STATUSES.map(
                                                                (s) => (
                                                                    <option
                                                                        key={s}
                                                                        value={s}
                                                                    >
                                                                        {s}
                                                                    </option>
                                                                )
                                                            )}
                                                        </select>

                                                        <button
                                                            onClick={async () => {
                                                                if (
                                                                    r.status ===
                                                                    "admin"
                                                                )
                                                                    return;
                                                                if (
                                                                    !confirm(
                                                                        "Mark as fully paid and complete?"
                                                                    )
                                                                )
                                                                    return;
                                                                try {
                                                                    await updateStatus(
                                                                        r.id,
                                                                        "complete",
                                                                        true
                                                                    );
                                                                } catch (
                                                                er: any
                                                                ) {
                                                                    alert(
                                                                        er?.message ||
                                                                        "Error"
                                                                    );
                                                                }
                                                            }}
                                                            disabled={
                                                                r.status ===
                                                                "admin" ||
                                                                r.status ===
                                                                "complete" ||
                                                                r.status ===
                                                                "canceled"
                                                            }
                                                            title={
                                                                r.status ===
                                                                    "admin"
                                                                    ? "Admin blocks cannot be completed"
                                                                    : undefined
                                                            }
                                                            className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Fully Paid
                                                        </button>

                                                        <button
                                                            onClick={async () => {
                                                                if (
                                                                    !confirm(
                                                                        "Cancel reservation?"
                                                                    )
                                                                )
                                                                    return;
                                                                try {
                                                                    await updateStatus(
                                                                        r.id,
                                                                        "canceled"
                                                                    );
                                                                } catch (
                                                                er: any
                                                                ) {
                                                                    alert(
                                                                        er?.message ||
                                                                        "Error"
                                                                    );
                                                                }
                                                            }}
                                                            className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            disabled={
                                                                r.status ===
                                                                "admin" ||
                                                                r.status ===
                                                                "complete" ||
                                                                r.status ===
                                                                "canceled"
                                                            }
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Calendar + Block */}
                <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Calendar */}
                    <div className="lg:col-span-2 bg-white border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="font-semibold">
                                Global Calendar
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    className="rounded-md border px-2 py-1 text-xs"
                                    onClick={() => {
                                        const d = new Date(
                                            calYear,
                                            calMonth,
                                            1
                                        );
                                        d.setMonth(d.getMonth() - 1);
                                        setCalYear(d.getFullYear());
                                        setCalMonth(d.getMonth());
                                    }}
                                >
                                    ◀
                                </button>
                                <div className="text-sm">
                                    {new Date(
                                        calYear,
                                        calMonth,
                                        1
                                    ).toLocaleString(undefined, {
                                        month: "long",
                                        year: "numeric",
                                    })}
                                </div>
                                <button
                                    className="rounded-md border px-2 py-1 text-xs"
                                    onClick={() => {
                                        const d = new Date(
                                            calYear,
                                            calMonth,
                                            1
                                        );
                                        d.setMonth(d.getMonth() + 1);
                                        setCalYear(d.getFullYear());
                                        setCalMonth(d.getMonth());
                                    }}
                                >
                                    ▶
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-2 text-xs text-neutral-600 mb-1">
                            {[
                                "Mon",
                                "Tue",
                                "Wed",
                                "Thu",
                                "Fri",
                                "Sat",
                                "Sun",
                            ].map((d) => (
                                <div key={d} className="text-center">
                                    {d}
                                </div>
                            ))}
                        </div>

                        {occLoading && (
                            <div className="text-xs text-neutral-600 mb-2">
                                Loading…
                            </div>
                        )}
                        {occErr && (
                            <div className="text-xs text-red-600 mb-2 whitespace-pre-wrap">
                                {occErr}
                            </div>
                        )}

                        <div className="grid grid-cols-7 gap-2">
                            {calendarCells.map((cell) => {
                                if (!cell.iso) {
                                    return (
                                        <div
                                            key={cell.key}
                                            className="h-16 rounded-md border bg-neutral-50/50"
                                            aria-hidden
                                        />
                                    );
                                }

                                const list = dayMap.get(cell.iso) || [];
                                const hasAdmin = list.some(
                                    (r) => r.status === "admin"
                                );
                                const onlyAdmin =
                                    hasAdmin &&
                                    list.every((r) => r.status === "admin");
                                const busy = list.length > 0;

                                return (
                                    <button
                                        key={cell.key}
                                        onClick={() =>
                                            setSelectedDay(cell.iso!)
                                        }
                                        className={`h-16 rounded-md border text-xs flex flex-col items-center justify-center ${onlyAdmin
                                            ? "bg-neutral-200 border-neutral-300 text-neutral-700"
                                            : busy
                                                ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40"
                                                : "bg-white"
                                            } hover:bg-neutral-50`}
                                    >
                                        <div className="font-semibold">
                                            {cell.dayNum}
                                        </div>
                                        {onlyAdmin ? (
                                            <div className="text-[10px] text-neutral-700">
                                                Reservation <br />
                                                by admin
                                            </div>
                                        ) : (
                                            busy && (
                                                <div className="text-[10px] text-[var(--color-primary-dark)]">
                                                    {list.length} Reservation
                                                    {list.length > 1 ? "s" : ""}
                                                </div>
                                            )
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {selectedDay && (
                            <div className="mt-4 border-t pt-3">
                                <div className="text-sm font-semibold">
                                    Reservations on {selectedDay}
                                </div>

                                <div className="mt-2 grid gap-2">
                                    {(dayMap.get(selectedDay) || []).map((r) => {
                                        const customerName = r.name || r.customer?.name || "—";
                                        const customerEmail = r.customerEmail || r.email || r.customer?.email || "—";
                                        const totalStay =
                                            r.totalStay ??
                                            r.discountedGrandTotal ??
                                            r.discountedTotal ??
                                            r.grandTotal ??
                                            r.total ??
                                            0;
                                        const jacuzziDays = r.jacuzzi?.days ?? 0;

                                        return (
                                            <div
                                                key={r.id}
                                                className="rounded-md border p-2 text-xs bg-white"
                                            >
                                                <div className="font-semibold">
                                                    {r.checkIn} → {r.checkOut}{" "}
                                                    <span className="ml-1">({r.status})</span>
                                                </div>

                                                <div>
                                                    Stay:{" "}
                                                    {r.houseId
                                                        ? PROPERTY_NAME_MAP[r.houseId] || r.houseId
                                                        : r.houseIds
                                                            ?.map((id: string) => PROPERTY_NAME_MAP[id] || id)
                                                            .join(", ")}
                                                </div>

                                                <div>Guest: {customerName}</div>
                                                <div>Email: {customerEmail}</div>

                                                {(r.phone || r.customer?.phone) && (
                                                    <div>Phone: {r.phone || r.customer?.phone}</div>
                                                )}

                                                <div>
                                                    Guests: {r.guests ?? "—"}
                                                    {r.extraGuests ? ` (+${r.extraGuests} extra)` : ""}
                                                </div>

                                                <div>
                                                    Total: {totalStay.toFixed(2)}€
                                                    {r.jacuzzi?.enabled && (
                                                        <span>
                                                            {" "}
                                                            (+{r.jacuzziFee ?? 0}€ jacuzzi
                                                            {jacuzziDays > 0 && ` ${jacuzziDays}d`})
                                                        </span>
                                                    )}
                                                </div>

                                                {(r.arrivalTime || r.customer?.arrivalTime) && (
                                                    <div>
                                                        Arrival time: {r.arrivalTime || r.customer?.arrivalTime}
                                                    </div>
                                                )}

                                                {(r.comment || r.customer?.comment) && (
                                                    <div className="mt-1 text-neutral-600">
                                                        Comment: {r.comment || r.customer?.comment}
                                                    </div>
                                                )}

                                                {r.adminNote && (
                                                    <div className="mt-1 text-neutral-600">
                                                        Admin note: {r.adminNote}
                                                    </div>
                                                )}

                                                <div className="mt-2 flex gap-2">
                                                    <button
                                                        onClick={async () => {
                                                            if (r.status === "admin") return;
                                                            if (!confirm("Mark as fully paid and complete?")) return;

                                                            try {
                                                                await updateStatus(r.id, "complete", true);
                                                            } catch (er: any) {
                                                                alert(er?.message || "Error");
                                                            }
                                                        }}
                                                        disabled={r.status === "admin"}
                                                        title={
                                                            r.status === "admin"
                                                                ? "Admin blocks cannot be completed"
                                                                : undefined
                                                        }
                                                        className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Fully Paid
                                                    </button>

                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await updateStatus(r.id, "canceled");
                                                            } catch (e: any) {
                                                                alert(e?.message || "Error");
                                                            }
                                                        }}
                                                        className="rounded-md border px-2 py-1 hover:bg-neutral-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Block form */}
                    <div className="bg-white border rounded-xl p-4">
                        <div className="font-semibold mb-2">
                            Block dates
                        </div>
                        <div className="grid gap-3 text-sm">
                            <div>
                                <label className="text-xs text-neutral-600">
                                    From
                                </label>
                                <input
                                    type="date"
                                    value={blockStart}
                                    onChange={(e) =>
                                        setBlockStart(e.target.value)
                                    }
                                    className="w-full border rounded-md p-2 mt-1"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-neutral-600">
                                    To
                                </label>
                                <input
                                    type="date"
                                    value={blockEnd}
                                    onChange={(e) =>
                                        setBlockEnd(e.target.value)
                                    }
                                    className="w-full border rounded-md p-2 mt-1"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-neutral-600">
                                    House *
                                </label>
                                <select
                                    value={blockHouseId}
                                    onChange={(e) =>
                                        setBlockHouseId(e.target.value)
                                    }
                                    className="w-full border rounded-md p-2 mt-1"
                                >
                                    <option value="">— Select —</option>
                                    {HOUSE_OPTIONS.map((h) => (
                                        <option key={h.id} value={h.id}>
                                            {h.alias}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-neutral-600">
                                    Guests
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={8}
                                    step={1}
                                    value={blockGuests}
                                    onChange={(e) => {
                                        const n = parseInt(
                                            e.target.value || "1",
                                            10
                                        );
                                        const clamped = Math.min(
                                            8,
                                            Math.max(1, isNaN(n) ? 1 : n)
                                        );
                                        setBlockGuests(clamped);
                                    }}
                                    className="w-full border rounded-md p-2 mt-1"
                                />
                            </div>

                            <div className="border-t pt-3 mt-2">
                                <div className="text-xs font-semibold text-neutral-700 mb-2">
                                    Customer information *
                                </div>

                                <div className="mb-2">
                                    <label className="text-xs text-neutral-600">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={blockCustomerName}
                                        onChange={(e) =>
                                            setBlockCustomerName(e.target.value)
                                        }
                                        placeholder="Customer name"
                                        className="w-full border rounded-md p-2 mt-1"
                                    />
                                </div>

                                <div className="mb-2">
                                    <label className="text-xs text-neutral-600">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={blockCustomerEmail}
                                        onChange={(e) =>
                                            setBlockCustomerEmail(e.target.value)
                                        }
                                        placeholder="email@example.com"
                                        className="w-full border rounded-md p-2 mt-1"
                                    />
                                </div>

                                <div className="mb-2">
                                    <label className="text-xs text-neutral-600">
                                        Phone
                                    </label>
                                    <input
                                        type="tel"
                                        value={blockCustomerPhone}
                                        onChange={(e) =>
                                            setBlockCustomerPhone(e.target.value)
                                        }
                                        placeholder="+34 600 000 000"
                                        className="w-full border rounded-md p-2 mt-1"
                                    />
                                </div>

                                <div className="mb-2">
                                    <label className="text-xs text-neutral-600">
                                        Arrival time
                                    </label>
                                    <input
                                        type="time"
                                        value={blockArrivalTime}
                                        onChange={(e) =>
                                            setBlockArrivalTime(e.target.value)
                                        }
                                        className="w-full border rounded-md p-2 mt-1"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-neutral-600">
                                        Comment
                                    </label>
                                    <textarea
                                        value={blockComment}
                                        onChange={(e) =>
                                            setBlockComment(e.target.value)
                                        }
                                        rows={2}
                                        placeholder="Additional comments"
                                        className="w-full border rounded-md p-2 mt-1"
                                    />
                                </div>
                            </div>

                            {/* Jacuzzi section */}
                            <div className="border-t pt-3 mt-2">
                                <div className="text-xs font-semibold text-neutral-700 mb-2">
                                    Extras
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer mb-2">
                                    <input
                                        type="checkbox"
                                        className="mt-1 w-4 h-4 rounded border-gray-400 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                        checked={blockWithJacuzzi}
                                        onChange={(e) => {
                                            setBlockWithJacuzzi(e.target.checked);
                                            if (!e.target.checked) setBlockJacuzziDays(1);
                                        }}
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-gray-900">
                                            Private jacuzzi
                                        </div>
                                        <div className="text-xs text-gray-600">
                                            First day: 65€ (up to 2 guests, +10€/extra). Additional days: 45€/day (+10€/extra)
                                        </div>
                                    </div>
                                </label>

                                {blockWithJacuzzi && nights > 0 && (
                                    <div className="mt-2 flex items-center gap-3 pl-7">
                                        <label className="text-xs font-medium text-gray-700">
                                            Number of days:
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setBlockJacuzziDays(Math.max(1, blockJacuzziDays - 1))
                                                }
                                                disabled={blockJacuzziDays <= 1}
                                                className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                            >
                                                −
                                            </button>
                                            <span className="w-10 text-center font-semibold">
                                                {blockJacuzziDays}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setBlockJacuzziDays(
                                                        Math.min(nights, blockJacuzziDays + 1)
                                                    )
                                                }
                                                disabled={blockJacuzziDays >= nights}
                                                className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            (max: {nights} {nights === 1 ? "night" : "nights"})
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Discount section */}
                            <div className="border-t pt-3 mt-2">
                                <div className="text-xs font-semibold text-neutral-700 mb-2">
                                    Discount (optional)
                                </div>

                                <div className="flex flex-col gap-2">
                                    <input
                                        type="text"
                                        className="w-full border rounded-md p-2"
                                        placeholder="Enter discount code"
                                        value={blockDiscountCode}
                                        onChange={(e) => setBlockDiscountCode(e.target.value)}
                                    />

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleLookupDiscount}
                                            disabled={!blockDiscountCode.trim() || blockDiscountLookupLoading}
                                            className="flex-1 px-3 py-2 rounded-md bg-[var(--color-primary)] text-white text-xs font-semibold disabled:opacity-60"
                                        >
                                            {blockDiscountLookupLoading ? "Checking…" : "Lookup"}
                                        </button>

                                        {blockDiscountData && (
                                            <button
                                                type="button"
                                                onClick={handleClearDiscount}
                                                className="px-3 py-2 rounded-md border text-xs font-semibold"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {blockDiscountError && (
                                    <div className="text-xs text-red-600 mt-2">{blockDiscountError}</div>
                                )}

                                {blockDiscountData && (
                                    <div className="mt-3 text-xs text-gray-700 space-y-2 bg-gray-50 p-3 rounded-md">
                                        {blockDiscountData.kind === "coupon" && blockDiscountData.coupon && (
                                            <>
                                                <div className="font-medium">
                                                    Code: {blockDiscountData.coupon.code}{" "}
                                                    <span className="text-gray-500">
                                                        ({blockDiscountData.state})
                                                    </span>
                                                </div>
                                                <div>
                                                    Remaining balance:{" "}
                                                    <span className="font-semibold">
                                                        €{Number(blockDiscountData.coupon.remaining ?? 0).toFixed(2)}
                                                    </span>
                                                </div>

                                                {!blockDiscountApplied ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleApplyDiscount}
                                                        className="mt-2 px-3 py-1.5 rounded-md bg-[var(--color-primary)] text-white text-xs font-semibold"
                                                    >
                                                        Apply discount
                                                    </button>
                                                ) : (
                                                    <div className="mt-2 p-2 rounded-md bg-green-50 border border-green-200">
                                                        Discount applied: €{blockAppliedEuroDiscount.toFixed(2)}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setBlockDiscountApplied(false);
                                                                setBlockAppliedEuroDiscount(0);
                                                            }}
                                                            className="ml-2 underline"
                                                        >
                                                            Undo
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {blockDiscountData.kind === "percent" && blockDiscountData.percentDoc && (
                                            <>
                                                <div className="font-medium">
                                                    Code: {blockDiscountData.percentDoc.code}{" "}
                                                    <span className="text-gray-500">
                                                        ({blockDiscountData.state})
                                                    </span>
                                                </div>
                                                <div>
                                                    Discount:{" "}
                                                    <span className="font-semibold">
                                                        {blockDiscountData.percentDoc.percent}% off (Reservation fee only)
                                                    </span>
                                                </div>
                                                {blockDiscountData.percentDoc.expiresAt && (
                                                    <div className="text-gray-500">
                                                        Expires: {blockDiscountData.percentDoc.expiresAt}
                                                    </div>
                                                )}
                                                {blockDiscountData.percentDoc.used && (
                                                    <div className="text-red-600">(Already used)</div>
                                                )}

                                                {!blockDiscountApplied ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleApplyDiscount}
                                                        className="mt-2 px-3 py-1.5 rounded-md bg-[var(--color-primary)] text-white text-xs font-semibold"
                                                    >
                                                        Apply discount
                                                    </button>
                                                ) : (
                                                    <div className="mt-2 p-2 rounded-md bg-green-50 border border-green-200">
                                                        Discount applied: {blockAppliedEuroDiscount}%
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setBlockDiscountApplied(false);
                                                                setBlockAppliedEuroDiscount(0);
                                                            }}
                                                            className="ml-2 underline"
                                                        >
                                                            Undo
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Price Summary Section */}
                            {blockStart && 
                             blockEnd && 
                             blockHouseId && 
                             /^\d{4}-\d{2}-\d{2}$/.test(blockStart) &&
                             /^\d{4}-\d{2}-\d{2}$/.test(blockEnd) &&
                             blockStart < blockEnd && 
                             nights > 0 && (
                                <PriceSummaryBlock 
                                    houseId={blockHouseId}
                                    startDate={blockStart}
                                    endDate={blockEnd}
                                    guests={blockGuests}
                                    jacuzziEnabled={blockWithJacuzzi}
                                    jacuzziDays={blockJacuzziDays}
                                    discountApplied={blockDiscountApplied}
                                    discountData={blockDiscountData}
                                    appliedDiscount={blockAppliedEuroDiscount}
                                />
                            )}

                            <button
                                onClick={createBlock}
                                disabled={blockBusy}
                                className="mt-2 rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                            >
                                {blockBusy ? "Creating…" : "Block"}
                            </button>

                            {blockMsg && (
                                <div
                                    className={`text-xs mt-1 whitespace-pre-wrap ${blockMsg.startsWith("Error")
                                        ? "text-red-600"
                                        : "text-green-600"
                                        }`}
                                >
                                    {blockMsg}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}