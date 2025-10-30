// lib/checkout-utils.ts
import admin, { adminDb as db } from "@/lib/firebase-admin";

/* ---------------- Date utils (LOCAL) ---------------- */
export function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Date -> YYYY-MM-DD (LOCAL, no UTC shift) */
export function dateIsoLocal(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

/** Normalize different shapes to Date at local 00:00 */
export function toDateOnlyLocal(value: any): Date {
  let d: Date;
  if (value === undefined || value === null || value === "") {
    throw new Error(`Invalid date value (empty): ${String(value)}`);
  }
  if (typeof value?.toDate === "function") {
    d = value.toDate();
  } else if (
    typeof value === "object" &&
    (typeof (value as any).seconds === "number" ||
      typeof (value as any)._seconds === "number")
  ) {
    const seconds = (value as any).seconds ?? (value as any)._seconds;
    d = new Date(seconds * 1000);
  } else if (value instanceof Date) {
    d = value;
  } else if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, day] = value.split("-").map(Number);
      d = new Date(y, (m || 1) - 1, day || 1); // LOCAL
    } else {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        const maybe = value.split("T")[0];
        const parsed2 = new Date(maybe);
        if (Number.isNaN(parsed2.getTime()))
          throw new Error(`Invalid date string: ${value}`);
        d = parsed2;
      } else {
        d = parsed;
      }
    }
  } else {
    d = new Date(String(value));
  }
  if (Number.isNaN(d.getTime()))
    throw new Error(`Invalid date value: ${String(value)}`);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "YYYY-MM-DD" -> Date at local 00:00 */
export function dateFromIsoLocal(iso: string) {
  const [y, m, day] = (iso || "").split("-").map(Number);
  if (![y, m, day].every(Number.isFinite))
    throw new Error(`Invalid ISO date-only string: ${iso}`);
  const d = new Date(y, (m as number) - 1, day as number);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDaysLocal(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function weekdayKey(date: Date) {
  const map = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;
  return map[date.getDay()];
}

/* ---------------- Firestore helpers ---------------- */
export async function fetchHouseDoc(id: string) {
  const snap = await db.collection("houses").doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return {
    id: snap.id,
    alias: data.alias || "",
    name: data.name || "",
    type: data.type ?? null,
    maxGuests: typeof data.maxGuests === "number" ? data.maxGuests : null,
    includedGuests:
      typeof data.includedGuests === "number" ? data.includedGuests : 2,
    pricePerNight:
      typeof data.pricePerNight === "object" && data.pricePerNight
        ? data.pricePerNight
        : {},
    specialPrices:
      typeof data.specialPrices === "object" && data.specialPrices
        ? data.specialPrices
        : {},
  };
}

export function getPriceForDate(house: any, d: Date): number | null {
  if (!house) return null;
  const iso = dateIsoLocal(d);
  const sp = house?.specialPrices?.[iso];
  if (typeof sp === "number") return sp;
  const key = weekdayKey(d);
  const val = house?.pricePerNight?.[key];
  return typeof val === "number" ? val : null;
}

/* ---------------- Price calculation ---------------- */
export async function calculateNightsCore(
  houseIds: string[],
  startIsoLocal: string,
  endIsoLocal: string,
  guests: number
) {
  const houses: any[] = [];
  for (const id of houseIds) {
    const h = await fetchHouseDoc(id);
    if (!h) throw new Error(`House ${id} not found`);
    houses.push(h);
  }

  const start = dateFromIsoLocal(startIsoLocal);
  const end = dateFromIsoLocal(endIsoLocal);

  const nights = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (nights <= 0) throw new Error("Invalid date range");

  const includedBase = houses.reduce(
    (acc, h) => acc + (typeof h.includedGuests === "number" ? h.includedGuests : 2),
    0
  );

  const extraGuests = Math.max(0, guests - includedBase);
  const perNightSurcharge = extraGuests * 40; // EXTRA_GUEST_PRICE

  let totalNightsOnly = 0;
  let firstNightBase = 0;

  for (let i = 0; i < nights; i++) {
    const cur = addDaysLocal(start, i);
    let nightlySum = 0;
    for (const h of houses) {
      const p = getPriceForDate(h, cur);
      if (p === null) throw new Error(`Price missing for ${h.id} on ${dateIsoLocal(cur)}`);
      nightlySum += p;
      if (i === 0) firstNightBase += p;
    }
    nightlySum += perNightSurcharge;
    totalNightsOnly += nightlySum;
  }

  const firstNightCharge = firstNightBase + perNightSurcharge;

  return {
    totalNightsOnly,
    nights,
    firstNightCharge,
    includedBase,
    extraGuests,
  };
}

/* ---------------- House resolver ---------------- */
export async function resolveHouseIds(values: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const v of values) {
    const idCandidate = String(v);
    const doc = await db.collection("houses").doc(idCandidate).get();
    if (doc.exists) {
      out.push(doc.id);
      continue;
    }

    const q = await db.collection("houses").where("alias", "==", idCandidate).limit(1).get();
    if (!q.empty) {
      out.push(q.docs[0].id);
      continue;
    }

    const q2 = await db.collection("houses").where("type", "==", idCandidate).limit(1).get();
    if (!q2.empty) {
      out.push(q2.docs[0].id);
      continue;
    }

    throw new Error(`House identifier not found as docId or alias: ${v}`);
  }
  return out;
}
