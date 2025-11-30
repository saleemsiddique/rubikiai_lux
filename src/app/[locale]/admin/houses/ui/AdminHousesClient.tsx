// app/admin/houses/ui/AdminHousesClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from 'next-intl';

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
  name: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  weekdayPrices: Partial<Record<Weekday, number>>;
};

type House = HouseListItem & {
  images?: string[] | null;
  pricePerNight: Partial<Record<Weekday, number>>;
  seasons?: Season[];
  specialPrices?: Record<string, number>;
};

// Esta función se define en el componente para acceder a las traducciones
function getWeekLabel(t: any): Record<Weekday, string> {
  return {
    monday: t('houses.basePrices.monday'),
    tuesday: t('houses.basePrices.tuesday'),
    wednesday: t('houses.basePrices.wednesday'),
    thursday: t('houses.basePrices.thursday'),
    friday: t('houses.basePrices.friday'),
    saturday: t('houses.basePrices.saturday'),
    sunday: t('houses.basePrices.sunday'),
  };
}

async function readError(res: Response) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json?.error || JSON.stringify(json);
  } catch {
    return text || `${res.status} ${res.statusText}`;
  }
}

// helper de fecha
function isValidISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function formatDateToDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export default function AdminHousesClient() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const WEEK_LABEL = getWeekLabel(t);
  // ===== LISTA Y FILTRO =====
  const [list, setList] = useState<HouseListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // ===== DETALLE CASA SELECCIONADA =====
  const [house, setHouse] = useState<House | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ===== MOBILE: mostrar selector o editor =====
  const [showEditor, setShowEditor] = useState(false);

  // ===== FORM PRECIOS SEMANALES BASE =====
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

  // ===== TEMPORADAS =====
  const [seasonName, setSeasonName] = useState<string>("");
  const [seasonStart, setSeasonStart] = useState<string>(""); // YYYY-MM-DD
  const [seasonEnd, setSeasonEnd] = useState<string>(""); // YYYY-MM-DD
  const [seasonPrices, setSeasonPrices] = useState<Record<Weekday, string>>({
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  });
  const [seasonSaving, setSeasonSaving] = useState(false);
  const [seasonMsg, setSeasonMsg] = useState<string | null>(null);
  const [editingSeasonIndex, setEditingSeasonIndex] = useState<number | null>(null);

  // ===== PRECIOS ESPECIALES =====
  // rango
  const [rangeStart, setRangeStart] = useState<string>(""); // YYYY-MM-DD
  const [rangeEnd, setRangeEnd] = useState<string>(""); // YYYY-MM-DD
  const [rangePrice, setRangePrice] = useState<string>(""); // string del input

  // día individual
  const [specialDate, setSpecialDate] = useState<string>(""); // YYYY-MM-DD
  const [specialPrice, setSpecialPrice] = useState<string>(""); // string del input

  const [specialSaving, setSpecialSaving] = useState(false);
  const [specialMsg, setSpecialMsg] = useState<string | null>(null);

  // ===== CARGA LISTA DE CASAS =====
  useEffect(() => {
    (async () => {
      try {
        setListLoading(true);
        setListError(null);
        const res = await fetch(`/${locale}/api/admin/houses/list`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await readError(res));
        const data: { items: HouseListItem[] } = await res.json();
        setList(data.items || []);
      } catch (e: any) {
        console.error("[admin/houses] list error:", e);
        setListError(
          e?.message || "No se pudo cargar la lista de casas."
        );
      } finally {
        setListLoading(false);
      }
    })();
  }, []);

  // ===== FILTRO LISTA =====
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

  // ===== CARGA DETALLE DE UNA CASA =====
  const loadHouseById = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setLoadError(null);
      setSaveMsg(null);
      setHouse(null);

      const res = await fetch(
        `/api/admin/houses/lookup?q=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(await readError(res));
      const data: House = await res.json();
      setHouse(data);

      setForm({
        monday:
          data.pricePerNight.monday !== undefined
            ? String(data.pricePerNight.monday)
            : "",
        tuesday:
          data.pricePerNight.tuesday !== undefined
            ? String(data.pricePerNight.tuesday)
            : "",
        wednesday:
          data.pricePerNight.wednesday !== undefined
            ? String(data.pricePerNight.wednesday)
            : "",
        thursday:
          data.pricePerNight.thursday !== undefined
            ? String(data.pricePerNight.thursday)
            : "",
        friday:
          data.pricePerNight.friday !== undefined
            ? String(data.pricePerNight.friday)
            : "",
        saturday:
          data.pricePerNight.saturday !== undefined
            ? String(data.pricePerNight.saturday)
            : "",
        sunday:
          data.pricePerNight.sunday !== undefined
            ? String(data.pricePerNight.sunday)
            : "",
      });

      // limpiar mensajes especiales al cambiar de casa
      setRangeStart("");
      setRangeEnd("");
      setRangePrice("");
      setSpecialDate("");
      setSpecialPrice("");
      setSpecialMsg(null);

      // limpiar temporadas
      setSeasonName("");
      setSeasonStart("");
      setSeasonEnd("");
      setSeasonPrices({
        monday: "",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
        saturday: "",
        sunday: "",
      });
      setSeasonMsg(null);
      setEditingSeasonIndex(null);

      // En móvil, cambiar a vista de editor
      setShowEditor(true);
    } catch (e: any) {
      console.error("[admin/houses] lookup error:", e);
      setLoadError(e?.message || "No se pudo cargar la casa.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== GUARDAR PRECIOS SEMANALES BASE =====
  const savePrices = useCallback(async () => {
    if (!house) return;

    const WEEK_LABEL = getWeekLabel(t);
    const payload: Partial<Record<Weekday, number>> = {};
    for (const k of Object.keys(WEEK_LABEL) as Weekday[]) {
      const raw = (form[k] ?? "").trim();
      if (raw === "") continue;
      const num = Number(raw.replace(",", "."));
      if (!Number.isFinite(num) || num < 0) {
        setSaveMsg(
          `El valor de "${WEEK_LABEL[k]}" debe ser un número ≥ 0.`
        );
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
      setForm({
        monday:
          updated.pricePerNight.monday !== undefined
            ? String(updated.pricePerNight.monday)
            : "",
        tuesday:
          updated.pricePerNight.tuesday !== undefined
            ? String(updated.pricePerNight.tuesday)
            : "",
        wednesday:
          updated.pricePerNight.wednesday !== undefined
            ? String(updated.pricePerNight.wednesday)
            : "",
        thursday:
          updated.pricePerNight.thursday !== undefined
            ? String(updated.pricePerNight.thursday)
            : "",
        friday:
          updated.pricePerNight.friday !== undefined
            ? String(updated.pricePerNight.friday)
            : "",
        saturday:
          updated.pricePerNight.saturday !== undefined
            ? String(updated.pricePerNight.saturday)
            : "",
        sunday:
          updated.pricePerNight.sunday !== undefined
            ? String(updated.pricePerNight.sunday)
            : "",
      });
      setSaveMsg(t('houses.basePrices.successMessage'));
    } catch (e: any) {
      console.error("[admin/houses] save error:", e);
      setSaveMsg(
        `Error: ${e?.message || t('common.saving')}`
      );
    } finally {
      setSaving(false);
    }
  }, [house, form, t]);

  // ===== GUARDAR/ACTUALIZAR TEMPORADA =====
  const handleSaveSeason = useCallback(async () => {
    if (!house) return;

    const WEEK_LABEL = getWeekLabel(t);
    const name = seasonName.trim();
    const start = seasonStart.trim();
    const end = seasonEnd.trim();

    if (!name) {
      setSeasonMsg(t('houses.seasons.name'));
      return;
    }
    if (!isValidISODate(start) || !isValidISODate(end)) {
      setSeasonMsg("Las fechas deben ser válidas.");
      return;
    }

    const weekdayPrices: Partial<Record<Weekday, number>> = {};
    for (const k of Object.keys(WEEK_LABEL) as Weekday[]) {
      const raw = (seasonPrices[k] ?? "").trim();
      if (raw === "") continue;
      const num = Number(raw.replace(",", "."));
      if (!Number.isFinite(num) || num < 0) {
        setSeasonMsg(
          `El precio de "${WEEK_LABEL[k]}" debe ser un número ≥ 0.`
        );
        return;
      }
      weekdayPrices[k] = num;
    }

    try {
      setSeasonSaving(true);
      setSeasonMsg(null);
      const res = await fetch(
        `/api/admin/houses/${encodeURIComponent(house.id)}/seasons`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seasonIndex: editingSeasonIndex,
            season: {
              name,
              start,
              end,
              weekdayPrices,
            },
          }),
        }
      );
      if (!res.ok) throw new Error(await readError(res));
      const updated: House = await res.json();
      setHouse(updated);
      setSeasonMsg(
        editingSeasonIndex !== null
          ? t('houses.seasons.successUpdated')
          : t('houses.seasons.successCreated')
      );

      // Limpiar el formulario
      setSeasonName("");
      setSeasonStart("");
      setSeasonEnd("");
      setSeasonPrices({
        monday: "",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
        saturday: "",
        sunday: "",
      });
      setEditingSeasonIndex(null);
    } catch (e: any) {
      console.error("[admin/houses] season save error:", e);
      setSeasonMsg(`Error: ${e?.message || "No se pudo guardar la temporada"}`);
    } finally {
      setSeasonSaving(false);
    }
  }, [house, seasonName, seasonStart, seasonEnd, seasonPrices, editingSeasonIndex, t]);

  // ===== ELIMINAR TEMPORADA =====
  const handleDeleteSeason = useCallback(async (index: number) => {
    if (!house) return;
    if (!confirm(t('houses.seasons.confirmDelete'))) return;

    try {
      setSeasonSaving(true);
      setSeasonMsg(null);
      const res = await fetch(
        `/api/admin/houses/${encodeURIComponent(house.id)}/seasons`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seasonIndex: index }),
        }
      );
      if (!res.ok) throw new Error(await readError(res));
      const updated: House = await res.json();
      setHouse(updated);
      setSeasonMsg(t('houses.seasons.successDeleted'));
    } catch (e: any) {
      console.error("[admin/houses] season delete error:", e);
      setSeasonMsg(`Error: ${e?.message || "No se pudo eliminar la temporada"}`);
    } finally {
      setSeasonSaving(false);
    }
  }, [house, t]);

  // ===== EDITAR TEMPORADA =====
  const handleEditSeason = useCallback((index: number, season: Season) => {
    setSeasonName(season.name);
    setSeasonStart(season.start);
    setSeasonEnd(season.end);
    setSeasonPrices({
      monday:
        season.weekdayPrices.monday !== undefined
          ? String(season.weekdayPrices.monday)
          : "",
      tuesday:
        season.weekdayPrices.tuesday !== undefined
          ? String(season.weekdayPrices.tuesday)
          : "",
      wednesday:
        season.weekdayPrices.wednesday !== undefined
          ? String(season.weekdayPrices.wednesday)
          : "",
      thursday:
        season.weekdayPrices.thursday !== undefined
          ? String(season.weekdayPrices.thursday)
          : "",
      friday:
        season.weekdayPrices.friday !== undefined
          ? String(season.weekdayPrices.friday)
          : "",
      saturday:
        season.weekdayPrices.saturday !== undefined
          ? String(season.weekdayPrices.saturday)
          : "",
      sunday:
        season.weekdayPrices.sunday !== undefined
          ? String(season.weekdayPrices.sunday)
          : "",
    });
    setEditingSeasonIndex(index);
    setSeasonMsg(null);
  }, []);

  // ===== API helper para precios especiales =====
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

  // ===== APLICAR RANGO =====
  const handleApplyRange = useCallback(() => {
    if (!house) return;
    if (!isValidISODate(rangeStart) || !isValidISODate(rangeEnd)) {
      setSpecialMsg(
        t('houses.specialPrices.invalidRangeDateFormat')
      );
      return;
    }
    const num = Number(rangePrice.trim().replace(",", "."));
    if (!Number.isFinite(num) || num < 0) {
      setSpecialMsg(t('houses.specialPrices.invalidPrice'));
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
      t('houses.specialPrices.successSaved'),
      t('houses.specialPrices.applyingRange')
    );
  }, [house, rangeStart, rangeEnd, rangePrice, postSpecialPrices, t]);

  // ===== ELIMINAR RANGO =====
  const handleDeleteRange = useCallback(() => {
    if (!house) return;
    if (!isValidISODate(rangeStart) || !isValidISODate(rangeEnd)) {
      setSpecialMsg(
        t('houses.specialPrices.invalidRangeDateFormat')
      );
      return;
    }

    postSpecialPrices(
      {
        rangeDelete: {
          start: rangeStart,
          end: rangeEnd,
        },
      },
      t('houses.specialPrices.successDeleted'),
      t('houses.specialPrices.applyingRange')
    );
  }, [house, rangeStart, rangeEnd, postSpecialPrices, t]);

  // ===== GUARDAR DÍA INDIVIDUAL =====
  const handleSaveSingleDay = useCallback(() => {
    if (!house) return;
    const d = specialDate.trim();
    const raw = specialPrice.trim();

    if (!isValidISODate(d)) {
      setSpecialMsg(t('houses.specialPrices.invalidDateFormat'));
      return;
    }
    const num = Number(raw.replace(",", "."));
    if (!Number.isFinite(num) || num < 0) {
      setSpecialMsg(t('houses.specialPrices.invalidPrice'));
      return;
    }

    postSpecialPrices(
      {
        upsert: { [d]: num },
      },
      t('houses.specialPrices.successSaved'),
      t('houses.specialPrices.savingDay')
    );

    setSpecialPrice("");
  }, [house, specialDate, specialPrice, postSpecialPrices, t]);

  // ===== ELIMINAR DÍA INDIVIDUAL =====
  const handleDeleteSingleDay = useCallback(() => {
    if (!house) return;
    const d = specialDate.trim();
    if (!isValidISODate(d)) {
      setSpecialMsg(t('houses.specialPrices.invalidDateFormat'));
      return;
    }

    postSpecialPrices(
      {
        delete: [d],
      },
      t('houses.specialPrices.successDeleted'),
      t('houses.specialPrices.savingDay')
    );
  }, [house, specialDate, postSpecialPrices, t]);

  return (
    <div className="mt-4 md:mt-6">
      {/* Botón flotante en móvil para cambiar entre vistas */}
      {house && (
        <button
          onClick={() => setShowEditor(!showEditor)}
          className="lg:hidden fixed bottom-4 right-4 z-50 bg-[var(--color-primary)] text-white rounded-full p-4 shadow-lg hover:opacity-95"
          aria-label={showEditor ? "Ver lista de casas" : "Ver editor"}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {showEditor ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            )}
          </svg>
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* === Columna izquierda: selector de casas === */}
        <aside
          className={`bg-white border rounded-xl p-4 lg:col-span-1 ${showEditor && house ? "hidden lg:block" : "block"
            }`}
        >
          <div className="text-sm font-semibold">{t('houses.title')}</div>

          <div className="mt-2">
            <label className="block text-xs text-neutral-600">{t('common.filter')}</label>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('houses.filterPlaceholder')}
              className="w-full mt-1 p-2 rounded-md border text-base"
            />
          </div>

          {listError && (
            <div className="mt-3 text-sm text-red-600 whitespace-pre-wrap">
              {listError}
            </div>
          )}

          <div className="mt-3 max-h-[calc(100vh-16rem)] lg:max-h-[28rem] overflow-auto divide-y">
            {listLoading && (
              <div className="text-sm text-neutral-500">{t('houses.loading')}</div>
            )}
            {!listLoading && filtered.length === 0 && (
              <div className="text-sm text-neutral-500">
                {t('houses.noMatches')}
              </div>
            )}
            {filtered.map((h) => {
              const selected = house?.id === h.id;
              return (
                <button
                  key={h.id}
                  onClick={() => loadHouseById(h.id)}
                  className={`w-full text-left px-3 py-3 hover:bg-neutral-50 ${selected
                      ? "bg-neutral-50 border-l-4 border-[var(--color-primary)]"
                      : ""
                    }`}
                  title={h.alias}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm md:text-base">
                      {h.name || t('houses.noName')}
                    </span>
                    {typeof h.maxGuests === "number" && (
                      <span className="text-xs text-neutral-500 whitespace-nowrap">
                        {h.maxGuests} pax
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    <span className="font-mono break-all">{h.alias}</span>
                    {h.type ? <> · {h.type}</> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* === Columna derecha: editor === */}
        <section
          className={`lg:col-span-2 ${!showEditor && house ? "hidden lg:block" : "block"
            }`}
        >
          <div className="bg-white border rounded-xl p-3 md:p-4">
            {!house && !loading && (
              <div className="text-neutral-600 text-sm">
                {t('houses.selectHouseToEdit')}
              </div>
            )}
            {loading && (
              <div className="text-neutral-600 text-sm">{t('houses.loadingHouse')}</div>
            )}
            {loadError && (
              <div className="text-sm text-red-600 whitespace-pre-wrap mt-1">
                {loadError}
              </div>
            )}

            {house && (
              <div className="grid grid-cols-1 gap-3 md:gap-4">
                {/* Botón volver en móvil */}
                <button
                  onClick={() => setShowEditor(false)}
                  className="lg:hidden flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  {t('houses.backToList')}
                </button>

                {/* === Info básica === */}
                <div className="p-3 md:p-4 rounded-xl border bg-white grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-neutral-600">
                      {t('houses.basicInfo.name')}
                    </div>
                    <div className="mt-1 font-semibold text-sm md:text-base break-words">
                      {house.name}
                    </div>
                    {house.type && (
                      <div className="text-xs text-neutral-500 mt-1">
                        {t('houses.basicInfo.type')}: {house.type}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wider text-neutral-600">
                      Alias / ID
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="font-mono break-all">{house.alias}</span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      ID: <span className="font-mono break-all">{house.id}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wider text-neutral-600">
                      Aforo
                    </div>
                    <div className="mt-1">{house.maxGuests ?? "—"}</div>
                  </div>
                </div>

                {/* === Editor de precios semanales BASE === */}
                <div className="p-3 md:p-4 rounded-xl border bg-white">
                  <div className="text-sm font-semibold">
                    Precios base por día de la semana
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Estos precios se usan cuando no hay temporada activa
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
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
                          value={form[key]}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              [key]: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-md border p-2 text-base"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={savePrices}
                      disabled={saving}
                      className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                    >
                      {saving ? t('common.saving') : t('common.saveChanges')}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!house) return;
                        setForm({
                          monday:
                            house.pricePerNight.monday !== undefined
                              ? String(house.pricePerNight.monday)
                              : "",
                          tuesday:
                            house.pricePerNight.tuesday !== undefined
                              ? String(house.pricePerNight.tuesday)
                              : "",
                          wednesday:
                            house.pricePerNight.wednesday !== undefined
                              ? String(house.pricePerNight.wednesday)
                              : "",
                          thursday:
                            house.pricePerNight.thursday !== undefined
                              ? String(house.pricePerNight.thursday)
                              : "",
                          friday:
                            house.pricePerNight.friday !== undefined
                              ? String(house.pricePerNight.friday)
                              : "",
                          saturday:
                            house.pricePerNight.saturday !== undefined
                              ? String(house.pricePerNight.saturday)
                              : "",
                          sunday: house.pricePerNight.sunday !== undefined
                            ? String(house.pricePerNight.sunday)
                            : "",
                        });
                        setSaveMsg(null);
                      }}
                      className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50"
                    >
                      Deshacer cambios
                    </button>
                  </div>{saveMsg && (
                    <div className="mt-2 text-xs whitespace-pre-wrap">
                      {saveMsg}
                    </div>
                  )}
                </div>

                {/* === TEMPORADAS === */}
                <div className="p-3 md:p-4 rounded-xl border bg-white">
                  <div className="text-sm font-semibold">
                    {t('houses.seasons.title')}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {t('houses.seasons.subtitle')}
                  </div>

                  {/* Lista de temporadas existentes */}
                  {house.seasons && house.seasons.length > 0 && (
                    <div className="mt-4 border rounded-md divide-y max-h-64 overflow-auto">
                      {house.seasons.map((season, index) => (
                        <div
                          key={index}
                          className="p-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm break-words">
                              {season.name}
                            </div>
                            <div className="text-xs text-neutral-600 mt-1">
                              {formatDateToDisplay(season.start)} →{" "}
                              {formatDateToDisplay(season.end)}
                            </div>
                            <div className="text-xs text-neutral-500 mt-1 break-words">
                              {t('houses.seasons.weekdayPrices')}:{" "}
                              {Object.entries(season.weekdayPrices)
                                .filter(([_, v]) => v !== undefined)
                                .map(
                                  ([k, v]) =>
                                    `${getWeekLabel(t)[k as Weekday]}: ${v}€`
                                )
                                .join(", ") || t('houses.seasons.noPricesDefined')}
                            </div>
                          </div>
                          <div className="flex gap-2 self-end sm:self-start">
                            <button
                              type="button"
                              className="text-xs rounded-md border px-3 py-1 hover:bg-neutral-50 whitespace-nowrap"
                              onClick={() => handleEditSeason(index, season)}
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              type="button"
                              className="text-xs rounded-md border px-3 py-1 hover:bg-red-50 text-red-700 whitespace-nowrap"
                              onClick={() => handleDeleteSeason(index)}
                              disabled={seasonSaving}
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulario para crear/editar temporada */}
                  <div className="mt-4 border rounded-md p-3 bg-neutral-50">
                    <div className="text-xs uppercase tracking-wider text-neutral-600 mb-3">
                      {editingSeasonIndex !== null
                        ? t('houses.seasons.editing')
                        : t('houses.seasons.new')}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-600">
                          {t('houses.seasons.name')}
                        </label>
                        <input
                          type="text"
                          value={seasonName}
                          onChange={(e) => setSeasonName(e.target.value)}
                          placeholder={t('houses.seasons.namePlaceholder')}
                          className="mt-1 w-full rounded-md border p-2 text-base"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-neutral-600">
                            {t('houses.seasons.startDate')}
                          </label>
                          <input
                            type="date"
                            value={seasonStart}
                            onChange={(e) => setSeasonStart(e.target.value)}
                            className="mt-1 w-full rounded-md border p-2 text-base"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-neutral-600">
                            {t('houses.seasons.endDate')}
                          </label>
                          <input
                            type="date"
                            value={seasonEnd}
                            onChange={(e) => setSeasonEnd(e.target.value)}
                            className="mt-1 w-full rounded-md border p-2 text-base"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs text-neutral-600 mb-2">
                        {t('houses.seasons.weekdayPrices')}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {(Object.keys(getWeekLabel(t)) as Weekday[]).map((key) => (
                          <div key={key}>
                            <label className="block text-xs text-neutral-600">
                              {getWeekLabel(t)[key]}
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              inputMode="decimal"
                              value={seasonPrices[key]}
                              onChange={(e) =>
                                setSeasonPrices((s) => ({
                                  ...s,
                                  [key]: e.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-md border p-1.5 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleSaveSeason}
                        disabled={seasonSaving}
                        className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                      >
                        {seasonSaving
                          ? t('common.saving')
                          : editingSeasonIndex !== null
                            ? t('houses.seasons.updateSeason')
                            : t('houses.seasons.createSeason')}
                      </button>

                      {editingSeasonIndex !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setSeasonName("");
                            setSeasonStart("");
                            setSeasonEnd("");
                            setSeasonPrices({
                              monday: "",
                              tuesday: "",
                              wednesday: "",
                              thursday: "",
                              friday: "",
                              saturday: "",
                              sunday: "",
                            });
                            setEditingSeasonIndex(null);
                            setSeasonMsg(null);
                          }}
                          className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50"
                        >
                          {t('houses.seasons.cancelEdit')}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSeasonName("");
                          setSeasonStart("");
                          setSeasonEnd("");
                          setSeasonPrices({
                            monday: "",
                            tuesday: "",
                            wednesday: "",
                            thursday: "",
                            friday: "",
                            saturday: "",
                            sunday: "",
                          });
                          setEditingSeasonIndex(null);
                          setSeasonMsg(null);
                        }}
                        className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50"
                      >
                        Limpiar
                      </button>
                    </div>

                    {seasonMsg && (
                      <div className="mt-2 text-xs whitespace-pre-wrap">
                        {seasonMsg}
                      </div>
                    )}
                  </div>
                </div>

                {/* === Precios especiales (rango + día) === */}
                <div className="p-3 md:p-4 rounded-xl border bg-white">
                  <div className="text-sm font-semibold">
                    {t('houses.specialPrices.title')}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {t('houses.specialPrices.subtitle')}
                  </div>

                  {/* ---- RANGO ---- */}
                  <div className="mt-4 border rounded-md p-3">
                    <div className="text-xs uppercase tracking-wider text-neutral-600 mb-2">
                      {t('houses.specialPrices.range.title')}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-neutral-600">
                            {t('houses.specialPrices.range.from')}
                          </label>
                          <input
                            type="date"
                            value={rangeStart}
                            onChange={(e) => setRangeStart(e.target.value)}
                            className="mt-1 w-full rounded-md border p-2 text-base"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-neutral-600">
                            {t('houses.specialPrices.range.to')}
                          </label>
                          <input
                            type="date"
                            value={rangeEnd}
                            onChange={(e) => setRangeEnd(e.target.value)}
                            className="mt-1 w-full rounded-md border p-2 text-base"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-neutral-600">
                          {t('houses.specialPrices.range.pricePerNight')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={rangePrice}
                          onChange={(e) => setRangePrice(e.target.value)}
                          className="mt-1 w-full rounded-md border p-2 text-base"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row flex-wrap gap-2">
                      <button
                        onClick={handleApplyRange}
                        disabled={specialSaving}
                        className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                      >
                        {specialSaving ? t('common.saving') : t('houses.specialPrices.range.applyRange')}
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
                        {t('houses.specialPrices.range.clear')}
                      </button>
                    </div>
                  </div>

                  {/* ---- DÍA INDIVIDUAL ---- */}
                  <div className="mt-6 border rounded-md p-3">
                    <div className="text-xs uppercase tracking-wider text-neutral-600 mb-2">
                      {t('houses.specialPrices.singleDay.title')}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-600">
                          {t('houses.specialPrices.singleDay.date')}
                        </label>
                        <input
                          type="date"
                          value={specialDate}
                          onChange={(e) => setSpecialDate(e.target.value)}
                          className="mt-1 w-full rounded-md border p-2 text-base"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-neutral-600">
                          {t('houses.specialPrices.singleDay.pricePerNight')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={specialPrice}
                          onChange={(e) => setSpecialPrice(e.target.value)}
                          className="mt-1 w-full rounded-md border p-2 text-base"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row flex-wrap gap-2">
                      <button
                        onClick={handleSaveSingleDay}
                        disabled={specialSaving}
                        className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                      >
                        {specialSaving ? t('common.saving') : t('houses.specialPrices.singleDay.saveDay')}
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
                        {t('houses.specialPrices.singleDay.clear')}
                      </button>
                    </div>
                  </div>

                  {/* ---- LISTA DE OVERRIDES EXISTENTES ---- */}
                  <div className="mt-6">
                    <div className="text-xs uppercase tracking-wider text-neutral-600 mb-1">
                      {t('houses.specialPrices.configuredDates')}
                    </div>

                    {!house?.specialPrices ||
                      Object.keys(house.specialPrices).length === 0 ? (
                      <div className="text-sm text-neutral-500">
                        {t('houses.specialPrices.noSpecialPrices')}
                      </div>
                    ) : (
                      <div className="border rounded-md divide-y max-h-64 overflow-auto">
                        {Object.entries(house.specialPrices)
                          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                          .map(([iso, price]) => (
                            <div
                              key={iso}
                              className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
                                <span className="font-mono text-sm break-all">
                                  {iso}
                                </span>
                                <span className="text-sm whitespace-nowrap">
                                  — {price} €
                                </span>
                              </div>
                              <div className="flex gap-2 self-end sm:self-auto">
                                <button
                                  type="button"
                                  className="text-xs rounded-md border px-3 py-1 hover:bg-neutral-50 whitespace-nowrap"
                                  onClick={() => {
                                    setSpecialDate(iso);
                                    setSpecialPrice(String(price));
                                  }}
                                >
                                  {t('common.edit')}
                                </button>
                                <button
                                  type="button"
                                  className="text-xs rounded-md border px-3 py-1 hover:bg-red-50 text-red-700 whitespace-nowrap"
                                  onClick={() => {
                                    setSpecialDate(iso);
                                    postSpecialPrices(
                                      { delete: [iso] },
                                      t('houses.specialPrices.successDeleted'),
                                      t('houses.specialPrices.deleteError')
                                    );
                                  }}
                                >
                                  {t('common.delete')}
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
                  <div className="p-3 md:p-4 rounded-xl border bg-white">
                    <div className="text-sm font-semibold">{t('houses.images.title')}</div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
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
    </div>);
}