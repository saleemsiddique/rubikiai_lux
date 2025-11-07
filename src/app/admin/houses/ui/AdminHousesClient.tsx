// app/admin/houses/ui/AdminHousesClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

type HouseListItem = {
  id: string;
  alias: string;
  name: string;
  type?: string | null;
  maxGuests?: number | null;
};

type Season = {
  id: string;
  name?: string;
  start?: string; // YYYY-MM-DD (optional; if missing => STANDARD / fallback)
  end?: string; // YYYY-MM-DD (optional)
  weekdayPrices?: Partial<Record<Weekday, number>>;
  defaultPrice?: number | null;
};

type House = HouseListItem & {
  images?: string[] | null;
  // legacy single map for backward compatibility
  pricePerNight: Partial<Record<Weekday, number>>;
  specialPrices?: Record<string, number>;
  // new structure
  seasons?: Record<string, Season>;
};

const WEEK_LABEL: Record<Weekday, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

async function readError(res: Response) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json?.error || JSON.stringify(json);
  } catch {
    return text || `${res.status} ${res.statusText}`;
  }
}

function isValidISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function uidChunk() {
  return Math.random().toString(36).slice(2, 8);
}

export default function AdminHousesClient() {
  // ===== LISTA Y FILTRO =====
  const [list, setList] = useState<HouseListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // ===== DETALLE CASA SELECCIONADA =====
  const [house, setHouse] = useState<House | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ===== legacy weekday form (kept for backwards editing) =====
  const [form, setForm] = useState<Record<Weekday, string>>({
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // ===== SEASONS UI =====
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [seasonForm, setSeasonForm] = useState<{
    id?: string;
    name: string;
    start: string;
    end: string;
    defaultPrice: string;
    weekdayPrices: Record<Weekday, string>;
  }>({
    id: undefined,
    name: "",
    start: "",
    end: "",
    defaultPrice: "",
    weekdayPrices: {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    },
  });
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonMsg, setSeasonMsg] = useState<string | null>(null);

  // ===== PRECIOS ESPECIALES (mantener) =====
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");
  const [rangePrice, setRangePrice] = useState<string>("");
  const [specialDate, setSpecialDate] = useState<string>("");
  const [specialPrice, setSpecialPrice] = useState<string>("");
  const [specialSaving, setSpecialSaving] = useState(false);
  const [specialMsg, setSpecialMsg] = useState<string | null>(null);

  // ===== CARGA LISTA =====
  useEffect(() => {
    (async () => {
      try {
        setListLoading(true);
        setListError(null);
        const res = await fetch("/api/admin/houses/list", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await readError(res));
        const data: { items: HouseListItem[] } = await res.json();
        setList(data.items || []);
      } catch (e: any) {
        console.error("[admin/houses] list error:", e);
        setListError(e?.message || "No se pudo cargar la lista de casas.");
      } finally {
        setListLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((h) =>
      [h.name, h.alias, h.id, h.type ?? "", String(h.maxGuests ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [filter, list]);

  // ===== CARGA CASA =====
  const loadHouseById = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setLoadError(null);
      setSaveMsg(null);
      setSeasonMsg(null);
      setHouse(null);

      const res = await fetch(
        `/api/admin/houses/lookup?q=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(await readError(res));
      const data: House = await res.json();
      setHouse(data);

      // legacy weekday form
      setForm({
        monday:
          data.pricePerNight?.monday !== undefined
            ? String(data.pricePerNight.monday)
            : "",
        tuesday:
          data.pricePerNight?.tuesday !== undefined
            ? String(data.pricePerNight.tuesday)
            : "",
        wednesday:
          data.pricePerNight?.wednesday !== undefined
            ? String(data.pricePerNight.wednesday)
            : "",
        thursday:
          data.pricePerNight?.thursday !== undefined
            ? String(data.pricePerNight.thursday)
            : "",
        friday:
          data.pricePerNight?.friday !== undefined
            ? String(data.pricePerNight.friday)
            : "",
        saturday:
          data.pricePerNight?.saturday !== undefined
            ? String(data.pricePerNight.saturday)
            : "",
        sunday:
          data.pricePerNight?.sunday !== undefined
            ? String(data.pricePerNight.sunday)
            : "",
      });

      // init seasons form: pick the "standard" season (no start/end) if exists, else first
      const seasons = data.seasons || {};
      const standardEntry = Object.entries(seasons).find(
        ([, s]) => !s.start && !s.end
      );
      const firstEntry = Object.entries(seasons)[0];
      const pick = standardEntry
        ? standardEntry[0]
        : firstEntry
          ? firstEntry[0]
          : null;
      if (pick) {
        setSelectedSeasonId(pick);
        const s = seasons[pick];
        setSeasonForm({
          id: s.id,
          name: s.name || s.id,
          start: s.start || "",
          end: s.end || "",
          defaultPrice:
            typeof s.defaultPrice === "number" ? String(s.defaultPrice) : "",
          weekdayPrices: {
            monday:
              s.weekdayPrices?.monday !== undefined
                ? String(s.weekdayPrices.monday)
                : "",
            tuesday:
              s.weekdayPrices?.tuesday !== undefined
                ? String(s.weekdayPrices.tuesday)
                : "",
            wednesday:
              s.weekdayPrices?.wednesday !== undefined
                ? String(s.weekdayPrices.wednesday)
                : "",
            thursday:
              s.weekdayPrices?.thursday !== undefined
                ? String(s.weekdayPrices.thursday)
                : "",
            friday:
              s.weekdayPrices?.friday !== undefined
                ? String(s.weekdayPrices.friday)
                : "",
            saturday:
              s.weekdayPrices?.saturday !== undefined
                ? String(s.weekdayPrices.saturday)
                : "",
            sunday:
              s.weekdayPrices?.sunday !== undefined
                ? String(s.weekdayPrices.sunday)
                : "",
          },
        });
      } else {
        setSelectedSeasonId(null);
        setSeasonForm({
          id: undefined,
          name: "",
          start: "",
          end: "",
          defaultPrice: "",
          weekdayPrices: {
            monday: "",
            tuesday: "",
            wednesday: "",
            thursday: "",
            friday: "",
            saturday: "",
            sunday: "",
          },
        });
      }

      // clear specials UI
      setRangeStart("");
      setRangeEnd("");
      setRangePrice("");
      setSpecialDate("");
      setSpecialPrice("");
      setSpecialMsg(null);
    } catch (e: any) {
      console.error("[admin/houses] lookup error:", e);
      setLoadError(e?.message || "No se pudo cargar la casa.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== GUARDAR PRECIOS SEMANALES (legacy) =====
  const savePrices = useCallback(async () => {
    if (!house) return;

    const payload: Partial<Record<Weekday, number>> = {};
    for (const k of Object.keys(WEEK_LABEL) as Weekday[]) {
      const raw = (form[k] ?? "").trim();
      if (raw === "") continue;
      const num = Number(raw.replace(",", "."));
      if (!Number.isFinite(num) || num < 0) {
        setSaveMsg(`El valor de "${WEEK_LABEL[k]}" debe ser un número ≥ 0.`);
        return;
      }
      payload[k] = num;
    }

    try {
      setSaving(true);
      setSaveMsg(null);
      const res = await fetch(
        `/api/admin/houses/${encodeURIComponent(house.id)}/prices`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pricePerNight: payload }),
        }
      );
      if (!res.ok) throw new Error(await readError(res));
      const updated: House = await res.json();
      setHouse(updated);
      setSaveMsg("Precios actualizados correctamente.");
    } catch (e: any) {
      console.error("[admin/houses] save error:", e);
      setSaveMsg(`Error: ${e?.message || "No se pudo guardar"}`);
    } finally {
      setSaving(false);
    }
  }, [house, form]);

  // ===== SEASONS API (create/update/delete) =====
  const saveSeason = useCallback(async () => {
    if (!house) return;
    const bodyWeekday: Record<string, number> = {};
    for (const k of Object.keys(WEEK_LABEL) as Weekday[]) {
      const raw = (seasonForm.weekdayPrices?.[k] ?? "").trim();
      if (raw === "") continue;
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        setSeasonMsg(`Precio inválido para ${WEEK_LABEL[k]}`);
        return;
      }
      bodyWeekday[k] = n;
    }

    // validate start/end if provided
    if (seasonForm.start && !isValidISODate(seasonForm.start)) {
      setSeasonMsg("Fecha 'Desde' inválida (usa YYYY-MM-DD).");
      return;
    }
    if (seasonForm.end && !isValidISODate(seasonForm.end)) {
      setSeasonMsg("Fecha 'Hasta' inválida (usa YYYY-MM-DD).");
      return;
    }
    if (seasonForm.start && seasonForm.end) {
      const s = new Date(seasonForm.start);
      const e = new Date(seasonForm.end);
      if (e.getTime() < s.getTime()) {
        setSeasonMsg("La fecha 'Hasta' debe ser posterior o igual a 'Desde'.");
        return;
      }
    }

    const defaultPrice =
      seasonForm.defaultPrice?.trim() === ""
        ? undefined
        : Number(seasonForm.defaultPrice.replace(",", "."));
    if (
      seasonForm.defaultPrice?.trim() !== "" &&
      (!Number.isFinite(defaultPrice as number) || (defaultPrice as number) < 0)
    ) {
      setSeasonMsg("Default price debe ser número ≥ 0.");
      return;
    }

    try {
      setSeasonLoading(true);
      setSeasonMsg(null);
      const payload: any = {
        id: seasonForm.id || `season-${uidChunk()}`,
        name: seasonForm.name || seasonForm.id || `season-${uidChunk()}`,
        weekdayPrices: Object.keys(bodyWeekday).length
          ? bodyWeekday
          : undefined,
        defaultPrice:
          typeof defaultPrice === "number" ? defaultPrice : undefined,
      };
      // include start/end if present (if both blank => this is STANDARD/fallback)
      if (seasonForm.start) payload.start = seasonForm.start;
      if (seasonForm.end) payload.end = seasonForm.end;

      const res = await fetch(
        `/api/admin/houses/${encodeURIComponent(house.id)}/seasons`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(await readError(res));
      const updated: House = await res.json();
      setHouse(updated);
      setSeasonMsg("Season guardada.");
      setSelectedSeasonId(payload.id);
      // refresh form with saved values (normalize)
      const saved = (updated.seasons || {})[payload.id];
      if (saved) {
        setSeasonForm({
          id: saved.id,
          name: saved.name || saved.id,
          start: saved.start || "",
          end: saved.end || "",
          defaultPrice:
            typeof saved.defaultPrice === "number"
              ? String(saved.defaultPrice)
              : "",
          weekdayPrices: {
            monday:
              saved.weekdayPrices?.monday !== undefined
                ? String(saved.weekdayPrices.monday)
                : "",
            tuesday:
              saved.weekdayPrices?.tuesday !== undefined
                ? String(saved.weekdayPrices.tuesday)
                : "",
            wednesday:
              saved.weekdayPrices?.wednesday !== undefined
                ? String(saved.weekdayPrices.wednesday)
                : "",
            thursday:
              saved.weekdayPrices?.thursday !== undefined
                ? String(saved.weekdayPrices.thursday)
                : "",
            friday:
              saved.weekdayPrices?.friday !== undefined
                ? String(saved.weekdayPrices.friday)
                : "",
            saturday:
              saved.weekdayPrices?.saturday !== undefined
                ? String(saved.weekdayPrices.saturday)
                : "",
            sunday:
              saved.weekdayPrices?.sunday !== undefined
                ? String(saved.weekdayPrices.sunday)
                : "",
          },
        });
      }
    } catch (e: any) {
      console.error("saveSeason error:", e);
      setSeasonMsg(e?.message || "Error guardando season");
    } finally {
      setSeasonLoading(false);
    }
  }, [house, seasonForm]);

  const deleteSeason = useCallback(
    async (seasonId?: string) => {
      if (!house) return;
      const idToDelete = seasonId || seasonForm.id;
      if (!idToDelete) {
        setSeasonMsg("No hay season seleccionada para eliminar.");
        return;
      }
      if (!confirm("¿Eliminar season? Esta acción es irreversible.")) return;
      try {
        setSeasonLoading(true);
        setSeasonMsg(null);
        const res = await fetch(
          `/api/admin/houses/${encodeURIComponent(house.id)}/seasons`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: idToDelete }),
          }
        );
        if (!res.ok) throw new Error(await readError(res));
        const updated: House = await res.json();
        setHouse(updated);
        setSeasonMsg("Season eliminada.");
        // clear selection if deleted
        if (selectedSeasonId === idToDelete) {
          setSelectedSeasonId(null);
          setSeasonForm({
            id: undefined,
            name: "",
            start: "",
            end: "",
            defaultPrice: "",
            weekdayPrices: {
              monday: "",
              tuesday: "",
              wednesday: "",
              thursday: "",
              friday: "",
              saturday: "",
              sunday: "",
            },
          });
        }
      } catch (e: any) {
        console.error("deleteSeason error:", e);
        setSeasonMsg(e?.message || "Error eliminando season");
      } finally {
        setSeasonLoading(false);
      }
    },
    [house, seasonForm, selectedSeasonId]
  );

  // ===== PRECIOS ESPECIALES (mantener) =====
  const postSpecialPrices = useCallback(
    async (payload: any, successMsg: string, errorMsg: string) => {
      if (!house) return;
      try {
        setSpecialSaving(true);
        setSpecialMsg(null);
        const res = await fetch(
          `/api/admin/houses/${encodeURIComponent(house.id)}/special-prices`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) throw new Error(await readError(res));
        const updated: House = await res.json();
        setHouse(updated);
        setSpecialMsg(successMsg);
      } catch (e: any) {
        console.error("[admin/houses] special error:", e);
        setSpecialMsg(
          `${errorMsg}: ${e?.message || "Operación no completada"}`
        );
      } finally {
        setSpecialSaving(false);
      }
    },
    [house]
  );

  const handleApplyRange = useCallback(() => {
    if (!house) return;
    if (!isValidISODate(rangeStart) || !isValidISODate(rangeEnd)) {
      setSpecialMsg("Las fechas del rango deben tener formato YYYY-MM-DD.");
      return;
    }
    const num = Number(rangePrice.trim().replace(",", "."));
    if (!Number.isFinite(num) || num < 0) {
      setSpecialMsg("El precio debe ser un número ≥ 0.");
      return;
    }

    postSpecialPrices(
      {
        rangeUpsert: {
          start: rangeStart,
          end: rangeEnd,
          price: num,
        },
      },
      "Precio especial guardado.",
      "No se pudo guardar el rango"
    );
  }, [house, rangeStart, rangeEnd, rangePrice, postSpecialPrices]);

  const handleDeleteRange = useCallback(() => {
    if (!house) return;
    if (!isValidISODate(rangeStart) || !isValidISODate(rangeEnd)) {
      setSpecialMsg("Las fechas del rango deben tener formato YYYY-MM-DD.");
      return;
    }

    postSpecialPrices(
      {
        rangeDelete: {
          start: rangeStart,
          end: rangeEnd,
        },
      },
      "Precio(s) especial(es) eliminado(s).",
      "No se pudo eliminar el rango"
    );
  }, [house, rangeStart, rangeEnd, postSpecialPrices]);

  const handleSaveSingleDay = useCallback(() => {
    if (!house) return;
    const d = specialDate.trim();
    const raw = specialPrice.trim();

    if (!isValidISODate(d)) {
      setSpecialMsg("La fecha debe tener formato YYYY-MM-DD.");
      return;
    }
    const num = Number(raw.replace(",", "."));
    if (!Number.isFinite(num) || num < 0) {
      setSpecialMsg("El precio debe ser un número ≥ 0.");
      return;
    }

    postSpecialPrices(
      {
        upsert: { [d]: num },
      },
      "Precio especial guardado.",
      "No se pudo guardar el día"
    );

    setSpecialPrice("");
  }, [house, specialDate, specialPrice, postSpecialPrices]);

  const handleDeleteSingleDay = useCallback(() => {
    if (!house) return;
    const d = specialDate.trim();
    if (!isValidISODate(d)) {
      setSpecialMsg("La fecha debe tener formato YYYY-MM-DD.");
      return;
    }

    postSpecialPrices(
      {
        delete: [d],
      },
      "Precio(s) especial(es) eliminado(s).",
      "No se pudo eliminar el día"
    );
  }, [house, specialDate, postSpecialPrices]);

  // ===== RENDER =====
  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* === Columna izquierda: selector de casas === */}
      <aside className="bg-white border rounded-xl p-4 lg:col-span-1">
        <div className="text-sm font-semibold">Selecciona una casa</div>

        <div className="mt-2">
          <label className="block text-xs text-neutral-600">Filtrar</label>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Nombre, alias, id…"
            className="w-full mt-1 p-2 rounded-md border"
          />
        </div>

        {listError && (
          <div className="mt-3 text-sm text-red-600 whitespace-pre-wrap">
            {listError}
          </div>
        )}

        <div className="mt-3 max-h-[28rem] overflow-auto divide-y">
          {listLoading && (
            <div className="text-sm text-neutral-500">Cargando casas…</div>
          )}
          {!listLoading && filtered.length === 0 && (
            <div className="text-sm text-neutral-500">
              No hay casas que coincidan.
            </div>
          )}
          {filtered.map((h) => {
            const selected = house?.id === h.id;
            return (
              <button
                key={h.id}
                onClick={() => loadHouseById(h.id)}
                className={`w-full text-left px-3 py-2 hover:bg-neutral-50 ${selected ? "bg-neutral-50 border-l-4 border-[var(--color-primary)]" : ""}`}
                title={h.alias}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {h.name || "(Sin nombre)"}
                  </span>
                  {typeof h.maxGuests === "number" && (
                    <span className="text-xs text-neutral-500">
                      {h.maxGuests} pax
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500">
                  <span className="font-mono">{h.alias}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* === Columna derecha: editor === */}
      <section className="lg:col-span-2">
        <div className="bg-white border rounded-xl p-4">
          {!house && !loading && (
            <div className="text-neutral-600 text-sm">
              Selecciona una casa en la lista para editar sus precios.
            </div>
          )}
          {loading && (
            <div className="text-neutral-600 text-sm">Cargando casa…</div>
          )}
          {loadError && (
            <div className="text-sm text-red-600 whitespace-pre-wrap mt-1">
              {loadError}
            </div>
          )}

          {house && (
            <div className="grid grid-cols-1 gap-4">
              {/* Basic info */}
              <div className="p-4 rounded-xl border bg-white grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-neutral-600">
                    Nombre
                  </div>
                  <div className="mt-1 font-semibold">{house.name}</div>
                  {house.type && (
                    <div className="text-xs text-neutral-500 mt-1">
                      Tipo: {house.type}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-neutral-600">
                    Alias / ID
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="font-mono">{house.alias}</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    ID: <span className="font-mono">{house.id}</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-neutral-600">
                    Aforo
                  </div>
                  <div className="mt-1">{house.maxGuests ?? "—"}</div>
                </div>
              </div>

              {/* Seasons manager */}
              <div className="p-4 rounded-xl border bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      Seasons (modelo por temporada)
                    </div>
                    <div className="text-xs text-neutral-500">
                      Crea temporadas con rango de fechas y precios por día. Si
                      un season no tiene start/end será tratado como{" "}
                      <strong>standard (fallback)</strong>.
                    </div>
                  </div>
                </div>

                {/* seasons list */}
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-neutral-600 mb-2">
                    Temporadas existentes
                  </div>

                  {!house.seasons || Object.keys(house.seasons).length === 0 ? (
                    <div className="text-sm text-neutral-500">
                      No hay seasons. Crea el Standard o una temporada con
                      rango.
                    </div>
                  ) : (
                    <div className="border rounded-md divide-y max-h-48 overflow-auto">
                      {Object.entries(house.seasons)
                        .sort(([a, sa], [b, sb]) => {
                          // order: standard (no dates) first, then by start date
                          const aIsStd = !sa.start && !sa.end;
                          const bIsStd = !sb.start && !sb.end;
                          if (aIsStd && !bIsStd) return -1;
                          if (bIsStd && !aIsStd) return 1;
                          const aStart = sa.start || "";
                          const bStart = sb.start || "";
                          return aStart < bStart ? -1 : aStart > bStart ? 1 : 0;
                        })
                        .map(([id, s]) => (
                          <div
                            key={id}
                            className={`p-2 flex items-center justify-between gap-2 ${selectedSeasonId === id ? "bg-neutral-50" : ""}`}
                          >
                            <div>
                              <div className="font-mono text-sm">{s.id}</div>
                              <div className="text-sm">
                                {s.name || s.id}{" "}
                                {s.start
                                  ? `— ${s.start} → ${s.end || "?"}`
                                  : "— Standard / fallback"}{" "}
                                {s.defaultPrice ? ` — ${s.defaultPrice}€` : ""}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="text-xs rounded-md border px-3 py-1 hover:bg-neutral-50"
                                onClick={() => {
                                  // load into form for editing
                                  setSelectedSeasonId(id);
                                  setSeasonForm({
                                    id: s.id,
                                    name: s.name || s.id,
                                    start: s.start || "",
                                    end: s.end || "",
                                    defaultPrice:
                                      typeof s.defaultPrice === "number"
                                        ? String(s.defaultPrice)
                                        : "",
                                    weekdayPrices: {
                                      monday:
                                        s.weekdayPrices?.monday !== undefined
                                          ? String(s.weekdayPrices.monday)
                                          : "",
                                      tuesday:
                                        s.weekdayPrices?.tuesday !== undefined
                                          ? String(s.weekdayPrices.tuesday)
                                          : "",
                                      wednesday:
                                        s.weekdayPrices?.wednesday !== undefined
                                          ? String(s.weekdayPrices.wednesday)
                                          : "",
                                      thursday:
                                        s.weekdayPrices?.thursday !== undefined
                                          ? String(s.weekdayPrices.thursday)
                                          : "",
                                      friday:
                                        s.weekdayPrices?.friday !== undefined
                                          ? String(s.weekdayPrices.friday)
                                          : "",
                                      saturday:
                                        s.weekdayPrices?.saturday !== undefined
                                          ? String(s.weekdayPrices.saturday)
                                          : "",
                                      sunday:
                                        s.weekdayPrices?.sunday !== undefined
                                          ? String(s.weekdayPrices.sunday)
                                          : "",
                                    },
                                  });
                                  setSeasonMsg(null);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                className="text-xs rounded-md border px-3 py-1 hover:bg-red-50 text-red-700"
                                onClick={() => {
                                  deleteSeason(id);
                                }}
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {seasonMsg && (
                  <div className="mt-2 text-xs whitespace-pre-wrap">
                    {seasonMsg}
                  </div>
                )}
              </div>

              {/* Season editor */}
              <div className="p-4 rounded-xl border bg-white">
                <div className="text-sm font-semibold">
                  Crear / editar temporada
                </div>

                <div>
                  <label className="block text-xs text-neutral-600">
                    Nombre de la temporada
                  </label>
                  <input
                    value={seasonForm.name ?? ""}
                    onChange={(e) =>
                      setSeasonForm((s) => ({ ...s, name: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border p-2"
                    placeholder="Summer 2025"
                    required
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Nombre descriptivo (ej.{" "}
                    <span className="font-mono">Summer 2025</span>).
                  </p>
                </div>

                {/* Fecha inicio (obligatorio) */}
                <div>
                  <label className="block text-xs text-neutral-600">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={seasonForm.start ?? ""}
                    onChange={(e) =>
                      setSeasonForm((s) => ({ ...s, start: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border p-2"
                    required
                  />
                </div>

                {/* Fecha fin (obligatorio) */}
                <div>
                  <label className="block text-xs text-neutral-600">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={seasonForm.end ?? ""}
                    onChange={(e) =>
                      setSeasonForm((s) => ({ ...s, end: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border p-2"
                    required
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(Object.keys(WEEK_LABEL) as Weekday[]).map((key) => (
                    <div key={key}>
                      <label className="block text-xs text-neutral-600">
                        {WEEK_LABEL[key]}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={seasonForm.weekdayPrices?.[key] ?? ""}
                        onChange={(e) =>
                          setSeasonForm((s) => ({
                            ...s,
                            weekdayPrices: {
                              ...(s.weekdayPrices || {}),
                              [key]: e.target.value,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-md border p-2"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={saveSeason}
                    disabled={seasonLoading}
                    className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                  >
                    {seasonLoading ? "Guardando…" : "Guardar temporada"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSeasonForm({
                        id: undefined,
                        name: "",
                        start: "",
                        end: "",
                        defaultPrice: "",
                        weekdayPrices: {
                          monday: "",
                          tuesday: "",
                          wednesday: "",
                          thursday: "",
                          friday: "",
                          saturday: "",
                          sunday: "",
                        },
                      });
                      setSelectedSeasonId(null);
                      setSeasonMsg(null);
                    }}
                    className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50"
                  >
                    Limpiar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!seasonForm.id) {
                        setSeasonMsg(
                          "Introduce un ID para actualizar o crea primero."
                        );
                        return;
                      }
                      deleteSeason(seasonForm.id);
                    }}
                    className="rounded-md border px-4 py-2 text-sm hover:bg-red-50 text-red-700"
                  >
                    Eliminar temporada
                  </button>
                </div>

                {seasonMsg && (
                  <div className="mt-2 text-xs whitespace-pre-wrap">
                    {seasonMsg}
                  </div>
                )}
              </div>

              {/* === Precios especiales (rango + día) === */}
              <div className="p-4 rounded-xl border bg-white">
                <div className="text-sm font-semibold">Precios especiales</div>

                {/* ---- RANGO ---- */}
                <div className="mt-4 border rounded-md p-3">
                  <div className="text-xs uppercase tracking-wider text-neutral-600 mb-2">
                    Aplicar a un rango de fechas
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[auto_auto_auto] gap-3 items-end">
                    <div>
                      <label className="block text-xs text-neutral-600">
                        Desde
                      </label>
                      <input
                        type="date"
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        className="mt-1 w-full rounded-md border p-2"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-600">
                        Hasta
                      </label>
                      <input
                        type="date"
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        className="mt-1 w-full rounded-md border p-2"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-600">
                        Precio €/noche
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={rangePrice}
                        onChange={(e) => setRangePrice(e.target.value)}
                        className="mt-1 w-full rounded-md border p-2"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={handleApplyRange}
                      disabled={specialSaving}
                      className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                    >
                      {specialSaving ? "Guardando…" : "Aplicar rango"}
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteRange}
                      disabled={specialSaving}
                      className="rounded-md border px-4 py-2 text-sm hover:bg-red-50 text-red-700 disabled:opacity-60"
                    >
                      {specialSaving ? "Eliminando…" : "Eliminar rango"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRangeStart("");
                        setRangeEnd("");
                        setRangePrice("");
                        setSpecialMsg(null);
                      }}
                      className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {/* ---- DÍA INDIVIDUAL ---- */}
                <div className="mt-6 border rounded-md p-3">
                  <div className="text-xs uppercase tracking-wider text-neutral-600 mb-2">
                    Ajustar un día concreto
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[auto_auto] gap-3 items-end">
                    <div>
                      <label className="block text-xs text-neutral-600">
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={specialDate}
                        onChange={(e) => setSpecialDate(e.target.value)}
                        className="mt-1 w-full rounded-md border p-2"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-600">
                        Precio €/noche
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={specialPrice}
                        onChange={(e) => setSpecialPrice(e.target.value)}
                        className="mt-1 w-full rounded-md border p-2"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={handleSaveSingleDay}
                      disabled={specialSaving}
                      className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                    >
                      {specialSaving ? "Guardando…" : "Guardar día"}
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteSingleDay}
                      disabled={specialSaving}
                      className="rounded-md border px-4 py-2 text-sm hover:bg-red-50 text-red-700 disabled:opacity-60"
                    >
                      {specialSaving ? "Eliminando…" : "Eliminar día"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSpecialDate("");
                        setSpecialPrice("");
                        setSpecialMsg(null);
                      }}
                      className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {/* ---- LISTA DE OVERRIDES EXISTENTES ---- */}
                <div className="mt-6">
                  <div className="text-xs uppercase tracking-wider text-neutral-600 mb-1">
                    Fechas configuradas
                  </div>

                  {!house?.specialPrices ||
                  Object.keys(house.specialPrices).length === 0 ? (
                    <div className="text-sm text-neutral-500">
                      No hay precios especiales.
                    </div>
                  ) : (
                    <div className="border rounded-md divide-y max-h-64 overflow-auto">
                      {Object.entries(house.specialPrices)
                        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                        .map(([iso, price]) => (
                          <div
                            key={iso}
                            className="p-2 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm">{iso}</span>
                              <span className="text-sm">— {price} €</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="text-xs rounded-md border px-3 py-1 hover:bg-neutral-50"
                                onClick={() => {
                                  setSpecialDate(iso);
                                  setSpecialPrice(String(price));
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="text-xs rounded-md border px-3 py-1 hover:bg-red-50 text-red-700"
                                onClick={() => {
                                  setSpecialDate(iso);
                                  postSpecialPrices(
                                    { delete: [iso] },
                                    "Precio(s) especial(es) eliminado(s).",
                                    "No se pudo eliminar el día"
                                  );
                                }}
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {specialMsg && (
                  <div className="mt-2 text-xs whitespace-pre-wrap">
                    {specialMsg}
                  </div>
                )}
              </div>

              {/* === Imágenes === */}
              {!!house.images?.length && (
                <div className="p-4 rounded-xl border bg-white">
                  <div className="text-sm font-semibold">Imágenes</div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {house.images!.map((src, i) => (
                      <div
                        key={i}
                        className="aspect-video overflow-hidden rounded-lg border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
