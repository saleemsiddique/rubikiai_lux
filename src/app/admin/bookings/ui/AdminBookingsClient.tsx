// app/admin/bookings/ui/AdminBookingsClient.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

type Reservation = {
    id: string;
    checkIn: string;   // "YYYY-MM-DD" (local)
    checkOut: string;  // "YYYY-MM-DD" (local)
    status?: string;
    houseId?: string;
    houseIds?: string[];
    customerEmail?: string;
    guests?: number;
    total?: number;
    discountedTotal?: number;
    firstNightCharge?: number;
    createdAt?: any;
    paidAt?: any;
    [k: string]: any;
};

const STATUSES = ["reserved", "pending", "admin", "complete", "canceled", "expired"] as const;
const CALENDAR_STATUSES = new Set(["reserved", "admin", "complete"]);

/* ---------- helpers de fecha (LOCAL, sin toISOString) ---------- */
function pad2(n: number) {
    return n < 10 ? `0${n}` : `${n}`;
}
function ymdToISO(y: number, m1: number, d: number) {
    // m1 = month index (0..11)
    return `${y}-${pad2(m1 + 1)}-${pad2(d)}`;
}
function parseISOToLocalDate(s: string) {
    // "YYYY-MM-DD" -> Date local a las 00:00
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, (m - 1), d, 0, 0, 0, 0);
}
function toISOLocal(d: Date) {
    // Formatea usando campos locales
    return ymdToISO(d.getFullYear(), d.getMonth(), d.getDate());
}
function toISO(d: Date) {
    // alias
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
    // Comparación lexicográfica segura para YYYY-MM-DD
    if (a === b) return 0;
    return a < b ? -1 : 1;
}
function isoLt(a: string, b: string) { return isoCmp(a, b) < 0; }
function isoLe(a: string, b: string) { return isoCmp(a, b) <= 0; }

/* ---------- helpers de red ---------- */
async function readError(res: Response) {
    const text = await res.text();
    try {
        const json = JSON.parse(text);
        return json?.error || JSON.stringify(json);
    } catch {
        return text || `${res.status} ${res.statusText}`;
    }
}
function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = 20000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    const merged: RequestInit = { ...init, signal: controller.signal, cache: "no-store" as RequestCache };
    return fetch(input, merged).finally(() => clearTimeout(id));
}

export default function AdminBookingsClient() {
    const router = useRouter();

    // Filtros (activas por defecto)
    const [statusFilter, setStatusFilter] = useState<string[]>(["reserved", "pending", "admin"]);
    const [rangeStart, setRangeStart] = useState<string>(toISO(new Date()));
    const [rangeEnd, setRangeEnd] = useState<string>(addDaysISO(toISO(new Date()), 60));
    const [houseId, setHouseId] = useState<string>("");

    const [rows, setRows] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Calendario (mes visible)
    const today = new Date();
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth()); // 0..11
    const firstDayOfMonthISO = toISO(new Date(calYear, calMonth, 1));
    const lastDayOfMonthISO = toISO(new Date(calYear, calMonth, daysInMonth(calYear, calMonth)));

    // Rango visible del calendario
    const monthStart = firstDayOfMonthISO;
    const monthEndExclusive = addDaysISO(lastDayOfMonthISO, 1); // exclusivo

    const [occReservations, setOccReservations] = useState<Reservation[]>([]);
    const [occErr, setOccErr] = useState<string | null>(null);
    const [occLoading, setOccLoading] = useState(false);

    // Detalle lateral
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    // Bloqueo
    const [blockStart, setBlockStart] = useState<string>(firstDayOfMonthISO);
    const [blockEnd, setBlockEnd] = useState<string>(addDaysISO(firstDayOfMonthISO, 1));
    const [blockHouseId, setBlockHouseId] = useState<string>("");
    const [blockNote, setBlockNote] = useState<string>("");
    const [blockBusy, setBlockBusy] = useState(false);
    const [blockMsg, setBlockMsg] = useState<string | null>(null);

    /* ---------- fetch listado ---------- */
    const fetchList = async () => {
        setLoading(true);
        setErr(null);
        try {
            const params = new URLSearchParams();
            if (statusFilter.length) params.set("status", statusFilter.join(","));
            if (rangeStart) params.set("start", rangeStart);
            if (rangeEnd) params.set("end", rangeEnd);
            if (houseId) params.set("houseId", houseId);
            params.set("limit", "1000");

            console.time("[UI] list fetch");
            const res = await fetchWithTimeout(`/api/admin/reservations/list?${params.toString()}`, {}, 20000);
            if (!res.ok) {
                const detail = await readError(res);
                throw new Error(detail);
            }
            const json = await res.json();
            console.timeEnd("[UI] list fetch]");
            setRows(json.results || []);
        } catch (e: any) {
            console.error("[UI] list error:", e);
            setErr(e?.message || "List error");
        } finally {
            setLoading(false);
        }
    };

    /* ---------- fetch ocupación (calendario) ---------- */
    // Celdas del calendario (con placeholders en el inicio/fin para alinear semanas)
    type DayCell = { key: string; iso?: string; dayNum?: number; isCurrentMonth: boolean };

    const calendarCells = useMemo<DayCell[]>(() => {
        const firstDayDate = new Date(calYear, calMonth, 1); // local
        const firstWeekday = firstDayDate.getDay(); // 0=Sun..6=Sat
        const daysCount = daysInMonth(calYear, calMonth);

        const cells: DayCell[] = [];

        // Placeholders previos hasta el primer weekday real
        for (let i = 0; i < firstWeekday; i++) {
            cells.push({ key: `p-${i}`, isCurrentMonth: false });
        }

        // Días del mes actual
        for (let d = 1; d <= daysCount; d++) {
            const iso = toISO(new Date(calYear, calMonth, d)); // "YYYY-MM-DD" en LOCAL
            cells.push({ key: `d-${iso}`, iso, dayNum: d, isCurrentMonth: true });
        }

        // Placeholders de cierre para completar la última fila
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
            const res = await fetchWithTimeout(`/api/admin/reservations/occupancy?${params.toString()}`, {}, 20000);
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

    /* ---------- map de días ocupados (ACOTADO AL MES, con CHECKOUT INCLUIDO) ---------- */
    const dayMap = useMemo(() => {
        const m = new Map<string, Reservation[]>();
        const MAX_DAYS_SAFE = 62; // por reserva dentro del mes; suficiente para meses largos + margen

        for (const r of occReservations) {
            const st = String(r.status || "").toLowerCase();
            if (!CALENDAR_STATUSES.has(st as any)) continue; // ignora canceled/expired (y cualquier otro no permitido)

            const ci = r.checkIn;
            const co = r.checkOut;
            if (!isISODate(ci) || !isISODate(co)) continue;

            // Limitar al rango visible del calendario
            const startUse = isoCmp(ci, monthStart) < 0 ? monthStart : ci;
            const endUse = isoCmp(co, monthEndExclusive) > 0 ? monthEndExclusive : co;

            // Queremos mostrar también el día de checkout como ocupado:
            // endLoopExclusive = min(endUse + 1 día, monthEndExclusive)
            const endLoopExclusive = isoCmp(addDaysISO(endUse, 1), monthEndExclusive) < 0
                ? addDaysISO(endUse, 1)
                : monthEndExclusive;

            if (!isoLt(startUse, endLoopExclusive)) continue;

            let d = startUse;
            let guard = 0;
            while (isoLt(d, endLoopExclusive) && guard < MAX_DAYS_SAFE) {
                const arr = m.get(d) || [];
                // De-duplicación por si llegara duplicada:
                if (!arr.some(x => x.id === r.id)) {
                    (r as any).__isCheckInDay = (d === r.checkIn);
                    (r as any).__isCheckOutDay = (d === r.checkOut)
                    arr.push(r);
                    m.set(d, arr);
                }
                d = addDaysISO(d, 1);
                guard++;
            }
            if (guard >= MAX_DAYS_SAFE) {
                console.warn("[calendar] Reserva acotada por seguridad:", r.id, ci, "→", co);
            }
        }
        return m;
    }, [occReservations, monthStart, monthEndExclusive]);

    // Estados que impiden bloquear si hay solape
    const BLOCKING_STATES = new Set(["reserved", "complete", "admin"]);

    function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
        // Todos en "YYYY-MM-DD", tratamos como [start, end) exclusivo
        return aStart < bEnd && bStart < aEnd;
    }

    async function checkBlockConflicts(startISO: string, endISO: string, houseId: string) {
        // Llama a tu endpoint de occupancy para el rango a bloquear
        const params = new URLSearchParams();
        params.set("start", startISO);
        params.set("end", endISO);
        if (houseId) params.set("houseId", houseId);

        const res = await fetchWithTimeout(`/api/admin/reservations/occupancy?${params.toString()}`, {}, 20000);
        if (!res.ok) {
            const detail = await readError(res);
            throw new Error(detail || "No se pudo comprobar ocupación");
        }
        const json = await res.json();
        const list: Reservation[] = json.results || [];

        // Filtra por estados que bloquean
        const blockers = list.filter(r => BLOCKING_STATES.has(String(r.status || "").toLowerCase() as any));

        // ¿Hay solape con el rango nuevo?
        return blockers.some(r => rangesOverlap(startISO, endISO, r.checkIn, r.checkOut));
    }


    /* ---------- acciones ---------- */
    const updateStatus = async (id: string, status: string, paidInFull?: boolean) => {
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

    const createBlock = async () => {
        setBlockBusy(true);
        setBlockMsg(null);
        try {
            // Validaciones locales
            if (!blockHouseId) {
                throw new Error("Debes indicar un House ID para bloquear.");
            }
            if (!(isISODate(blockStart) && isISODate(blockEnd)) || !(blockStart < blockEnd)) {
                throw new Error("Rango de fechas inválido.");
            }

            // no permitir pasado (comparamos con hoy local, sin horas)
            const todayISO = toISO(new Date());
            if (blockEnd <= todayISO) {
                throw new Error("No puedes bloquear fechas en el pasado.");
            }

            // Comprobar conflictos server-side (ocupación real) para el rango
            const hasConflict = await checkBlockConflicts(blockStart, blockEnd, blockHouseId);
            if (hasConflict) {
                throw new Error("Las fechas seleccionadas pisan una reserva existente (reserved / complete / admin).");
            }

            // Si todo ok → hacer el POST
            const res = await fetchWithTimeout(
                "/api/admin/reservations/block",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        checkIn: blockStart,
                        checkOut: blockEnd,
                        houseId: blockHouseId || undefined,
                        note: blockNote || undefined,
                    }),
                },
                20000
            );

            if (!res.ok) {
                const detail = await readError(res);
                throw new Error(detail);
            }

            setBlockMsg("Fechas bloqueadas correctamente.");
            setBlockNote("");
            await fetchList();
            await fetchMonthOccupancy();
        } catch (e: any) {
            setBlockMsg(`Error: ${e?.message || e}`);
        } finally {
            setBlockBusy(false);
        }
    };

    /* ---------- UI ---------- */
    return (
        <main className="min-h-screen pt-24 bg-[var(--color-background-main)]">
            <section className="max-w-6xl mx-auto px-6 py-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof window !== "undefined" && window.history.length > 1) {
                                    router.back();
                                } else {
                                    router.push("/admin/menu");
                                }
                            }}
                            className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                            aria-label="Volver"
                            title="Volver"
                        >
                            <span aria-hidden>←</span>
                            <span>Volver</span>
                        </button>

                        <h1 className="text-xl md:text-2xl font-bold text-[var(--color-primary-dark)]">Reservas</h1>
                    </div>

                    <button
                        onClick={fetchList}
                        disabled={loading}
                        className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
                    >
                        {loading ? "Cargando…" : "Refrescar"}
                    </button>
                </div>


                {/* Filtros */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 bg-white border rounded-xl p-4">
                    <div className="flex flex-col">
                        <label className="text-xs text-neutral-600">Estado</label>
                        <select
                            multiple
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(Array.from(e.target.selectedOptions).map((o) => o.value))
                            }
                            className="mt-1 border rounded-md p-2 h-[96px]"
                        >
                            {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                        <div className="text-[11px] text-neutral-500 mt-1">Ctrl/Cmd para multiselección</div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-neutral-600">Desde</label>
                        <input
                            type="date"
                            value={rangeStart}
                            onChange={(e) => setRangeStart(e.target.value)}
                            className="mt-1 border rounded-md p-2"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-neutral-600">Hasta</label>
                        <input
                            type="date"
                            value={rangeEnd}
                            onChange={(e) => setRangeEnd(e.target.value)}
                            className="mt-1 border rounded-md p-2"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-neutral-600">House ID (opcional)</label>
                        <input
                            value={houseId}
                            onChange={(e) => setHouseId(e.target.value)}
                            placeholder="L0TeFf2LmrWG..."
                            className="mt-1 border rounded-md p-2"
                        />
                    </div>

                    <div className="md:col-span-4 flex gap-2">
                        <button
                            onClick={fetchList}
                            className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95"
                        >
                            Buscar
                        </button>
                    </div>
                </div>

                {/* Tabla */}
                <div className="mt-6 bg-white border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b text-sm font-semibold">Resultados</div>
                    {loading ? (
                        <div className="p-4 text-sm text-neutral-600">Cargando…</div>
                    ) : err ? (
                        <div className="p-4 text-sm text-red-600 whitespace-pre-wrap">{err}</div>
                    ) : rows.length === 0 ? (
                        <div className="p-4 text-sm text-neutral-600">Sin resultados</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-neutral-50 text-neutral-700">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Fechas</th>
                                        <th className="px-3 py-2 text-left">Estado</th>
                                        <th className="px-3 py-2 text-left">House</th>
                                        <th className="px-3 py-2 text-left">Huésp.</th>
                                        <th className="px-3 py-2 text-left">Email</th>
                                        <th className="px-3 py-2 text-right">Total</th>
                                        <th className="px-3 py-2">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.id} className="border-t">
                                            <td className="px-3 py-2">
                                                {r.checkIn} → {r.checkOut}{" "}
                                                <span className="text-[10px] text-neutral-500">({r.nights ?? "?"}n)</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]">
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">{r.houseId ?? r.houseIds?.join(",")}</td>
                                            <td className="px-3 py-2">{r.guests ?? "—"}</td>
                                            <td className="px-3 py-2">{r.customerEmail ?? "—"}</td>
                                            <td className="px-3 py-2 text-right">{(r.discountedTotal ?? r.total ?? 0)}€</td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-2 justify-end">
                                                    <select
                                                        className="border rounded-md p-1 text-xs"
                                                        value={r.status}
                                                        onChange={async (e) => {
                                                            try {
                                                                await updateStatus(r.id, e.target.value);
                                                            } catch (er: any) {
                                                                alert(er?.message || "Error");
                                                            }
                                                        }}
                                                    >
                                                        {STATUSES.map((s) => (
                                                            <option key={s} value={s}>
                                                                {s}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    <button
                                                        onClick={async () => {
                                                            if (r.status === "admin") return;
                                                            if (!confirm("¿Marcar pago completo y completar?")) return;
                                                            try {
                                                                await updateStatus(r.id, "complete", true);
                                                            } catch (er: any) {
                                                                alert(er?.message || "Error");
                                                            }
                                                        }}
                                                        disabled={r.status === "admin" || r.status === "complete" || r.status === "canceled"}
                                                        title={r.status === "admin" ? "Bloqueos de admin no pueden completarse" : undefined}
                                                        className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Pago completo
                                                    </button>


                                                    <button
                                                        onClick={async () => {
                                                            if (!confirm("¿Cancelar reserva?")) return;
                                                            try {
                                                                await updateStatus(r.id, "canceled");
                                                            } catch (er: any) {
                                                                alert(er?.message || "Error");
                                                            }
                                                        }}
                                                        className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        disabled={r.status == "admin" || r.status == "complete" || r.status == "canceled"}
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Calendario + Bloqueo */}
                <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Calendario */}
                    <div className="lg:col-span-2 bg-white border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="font-semibold">Calendario global</div>
                            <div className="flex items-center gap-2">
                                <button
                                    className="rounded-md border px-2 py-1 text-xs"
                                    onClick={() => {
                                        const d = new Date(calYear, calMonth, 1);
                                        d.setMonth(d.getMonth() - 1);
                                        setCalYear(d.getFullYear());
                                        setCalMonth(d.getMonth());
                                    }}
                                >
                                    ◀
                                </button>
                                <div className="text-sm">
                                    {new Date(calYear, calMonth, 1).toLocaleString(undefined, {
                                        month: "long",
                                        year: "numeric",
                                    })}
                                </div>
                                <button
                                    className="rounded-md border px-2 py-1 text-xs"
                                    onClick={() => {
                                        const d = new Date(calYear, calMonth, 1);
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
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                                <div key={d} className="text-center">
                                    {d}
                                </div>
                            ))}
                        </div>

                        {occLoading && (
                            <div className="text-xs text-neutral-600 mb-2">Cargando ocupación…</div>
                        )}
                        {occErr && (
                            <div className="text-xs text-red-600 mb-2 whitespace-pre-wrap">{occErr}</div>
                        )}

                        <div className="grid grid-cols-7 gap-2">
                            {calendarCells.map((cell) => {
                                // Placeholders (celdas fuera del mes actual): caja vacía
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
                                const hasAdmin = list.some(r => r.status === "admin");
                                const onlyAdmin = hasAdmin && list.every(r => r.status === "admin");
                                const busy = list.length > 0;

                                return (
                                    <button
                                        key={cell.key}
                                        onClick={() => setSelectedDay(cell.iso!)}
                                        className={`h-16 rounded-md border text-xs flex flex-col items-center justify-center ${onlyAdmin
                                            ? "bg-neutral-200 border-neutral-300 text-neutral-700"
                                            : busy
                                                ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40"
                                                : "bg-white"
                                            } hover:bg-neutral-50`}
                                    >
                                        <div className="font-semibold">{cell.dayNum}</div>
                                        {onlyAdmin ? (
                                            <div className="text-[10px] text-neutral-700">Bloqueado</div>
                                        ) : busy && (
                                            <div className="text-[10px] text-[var(--color-primary-dark)]">
                                                {list.length} reserva{list.length > 1 ? "s" : ""}
                                            </div>
                                        )}


                                    </button>
                                );
                            })}
                        </div>

                        {selectedDay && (
                            <div className="mt-4 border-t pt-3">
                                <div className="text-sm font-semibold">Reservas el {selectedDay}</div>
                                <div className="mt-2 grid gap-2">
                                    {(dayMap.get(selectedDay) || []).map((r) => (
                                        <div key={r.id} className="rounded-md border p-2 text-xs bg-white">
                                            <div className="font-semibold">
                                                {r.checkIn} → {r.checkOut} <span className="ml-1">({r.status})</span>
                                            </div>
                                            <div>House: {r.houseId ?? r.houseIds?.join(",")}</div>
                                            <div>
                                                Huéspedes: {r.guests ?? "—"} · Email: {r.customerEmail ?? "—"}
                                            </div>
                                            <div>Total: {(r.discountedTotal ?? r.total ?? 0)}€</div>
                                            <div className="mt-2 flex gap-2">
                                                <button
                                                    onClick={async () => {
                                                        if (r.status === "admin") return;
                                                        if (!confirm("¿Marcar pago completo y completar?")) return;
                                                        try {
                                                            await updateStatus(r.id, "complete", true);
                                                        } catch (er: any) {
                                                            alert(er?.message || "Error");
                                                        }
                                                    }}
                                                    disabled={r.status === "admin"}
                                                    title={r.status === "admin" ? "Bloqueos de admin no pueden completarse" : undefined}
                                                    className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Pago completo
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
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Bloqueo */}
                    <div className="bg-white border rounded-xl p-4">
                        <div className="font-semibold mb-2">Bloquear fechas</div>
                        <div className="grid gap-2 text-sm">
                            <label className="text-xs text-neutral-600">Desde</label>
                            <input
                                type="date"
                                value={blockStart}
                                onChange={(e) => setBlockStart(e.target.value)}
                                className="border rounded-md p-2"
                            />

                            <label className="text-xs text-neutral-600">Hasta</label>
                            <input
                                type="date"
                                value={blockEnd}
                                onChange={(e) => setBlockEnd(e.target.value)}
                                className="border rounded-md p-2"
                            />

                            <label className="text-xs text-neutral-600">House ID</label>
                            <input
                                value={blockHouseId}
                                onChange={(e) => setBlockHouseId(e.target.value)}
                                placeholder="L0TeFf2LmrWG..."
                                className="border rounded-md p-2"
                            />

                            <label className="text-xs text-neutral-600">Nota (opcional)</label>
                            <textarea
                                value={blockNote}
                                onChange={(e) => setBlockNote(e.target.value)}
                                rows={3}
                                className="border rounded-md p-2"
                            />

                            <button
                                onClick={createBlock}
                                disabled={blockBusy}
                                className="mt-2 rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                            >
                                {blockBusy ? "Creando…" : "Bloquear"}
                            </button>

                            {blockMsg && <div className="text-xs mt-1 whitespace-pre-wrap">{blockMsg}</div>}
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
