// app/admin/houses/ui/AdminHousesClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type HouseListItem = { id: string; alias: string; name: string; type?: string | null; maxGuests?: number | null };
type House = HouseListItem & {
  images?: string[] | null;
  pricePerNight: Partial<Record<Weekday, number>>;
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

export default function AdminHousesClient() {
  // Lista y filtro
  const [list, setList] = useState<HouseListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // Selección y detalle
  const [house, setHouse] = useState<House | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form precios
  const [form, setForm] = useState<Record<Weekday, string>>({
    monday: "", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // ------------- Carga lista de casas -------------
  useEffect(() => {
    (async () => {
      try {
        setListLoading(true);
        setListError(null);
        const res = await fetch("/api/admin/houses/list", { cache: "no-store" });
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

  // ------------- Filtro de lista -------------
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

  // ------------- Carga detalle + precios -------------
  const loadHouseById = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setLoadError(null);
      setSaveMsg(null);
      setHouse(null);

      const res = await fetch(`/api/admin/houses/lookup?q=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res));
      const data: House = await res.json();
      setHouse(data);

      setForm({
        monday: data.pricePerNight.monday !== undefined ? String(data.pricePerNight.monday) : "",
        tuesday: data.pricePerNight.tuesday !== undefined ? String(data.pricePerNight.tuesday) : "",
        wednesday: data.pricePerNight.wednesday !== undefined ? String(data.pricePerNight.wednesday) : "",
        thursday: data.pricePerNight.thursday !== undefined ? String(data.pricePerNight.thursday) : "",
        friday: data.pricePerNight.friday !== undefined ? String(data.pricePerNight.friday) : "",
        saturday: data.pricePerNight.saturday !== undefined ? String(data.pricePerNight.saturday) : "",
        sunday: data.pricePerNight.sunday !== undefined ? String(data.pricePerNight.sunday) : "",
      });
    } catch (e: any) {
      console.error("[admin/houses] lookup error:", e);
      setLoadError(e?.message || "No se pudo cargar la casa.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ------------- Guardar precios -------------
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
      const res = await fetch(`/api/admin/houses/${encodeURIComponent(house.id)}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricePerNight: payload }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const updated: House = await res.json();
      setHouse(updated);
      setForm({
        monday: updated.pricePerNight.monday !== undefined ? String(updated.pricePerNight.monday) : "",
        tuesday: updated.pricePerNight.tuesday !== undefined ? String(updated.pricePerNight.tuesday) : "",
        wednesday: updated.pricePerNight.wednesday !== undefined ? String(updated.pricePerNight.wednesday) : "",
        thursday: updated.pricePerNight.thursday !== undefined ? String(updated.pricePerNight.thursday) : "",
        friday: updated.pricePerNight.friday !== undefined ? String(updated.pricePerNight.friday) : "",
        saturday: updated.pricePerNight.saturday !== undefined ? String(updated.pricePerNight.saturday) : "",
        sunday: updated.pricePerNight.sunday !== undefined ? String(updated.pricePerNight.sunday) : "",
      });
      setSaveMsg("Precios actualizados correctamente.");
    } catch (e: any) {
      console.error("[admin/houses] save error:", e);
      setSaveMsg(`Error: ${e?.message || "No se pudo guardar"}`);
    } finally {
      setSaving(false);
    }
  }, [house, form]);

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Columna izquierda: selector de casas */}
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

        {listError && <div className="mt-3 text-sm text-red-600 whitespace-pre-wrap">{listError}</div>}

        <div className="mt-3 max-h-[28rem] overflow-auto divide-y">
          {listLoading && <div className="text-sm text-neutral-500">Cargando casas…</div>}
          {!listLoading && filtered.length === 0 && (
            <div className="text-sm text-neutral-500">No hay casas que coincidan.</div>
          )}
          {filtered.map((h) => {
            const selected = house?.id === h.id;
            return (
              <button
                key={h.id}
                onClick={() => loadHouseById(h.id)}
                className={`w-full text-left px-3 py-2 hover:bg-neutral-50 ${
                  selected ? "bg-neutral-50 border-l-4 border-[var(--color-primary)]" : ""
                }`}
                title={h.alias}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{h.name || "(Sin nombre)"}</span>
                  {typeof h.maxGuests === "number" && (
                    <span className="text-xs text-neutral-500">{h.maxGuests} pax</span>
                  )}
                </div>
                <div className="text-xs text-neutral-500">
                  <span className="font-mono">{h.alias}</span>
                  {h.type ? <> · {h.type}</> : null}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Columna derecha: editor (ocupa 2 cols en desktop) */}
      <section className="lg:col-span-2">
        <div className="bg-white border rounded-xl p-4">
          {!house && !loading && (
            <div className="text-neutral-600 text-sm">
              Selecciona una casa en la lista para editar sus precios.
            </div>
          )}
          {loading && <div className="text-neutral-600 text-sm">Cargando casa…</div>}
          {loadError && <div className="text-sm text-red-600 whitespace-pre-wrap mt-1">{loadError}</div>}

          {house && (
            <div className="grid grid-cols-1 gap-4">
              {/* Info básica */}
              <div className="p-4 rounded-xl border bg-white grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-neutral-600">Nombre</div>
                  <div className="mt-1 font-semibold">{house.name}</div>
                  {house.type && <div className="text-xs text-neutral-500 mt-1">Tipo: {house.type}</div>}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-neutral-600">Alias / ID</div>
                  <div className="mt-1 text-sm"><span className="font-mono">{house.alias}</span></div>
                  <div className="text-xs text-neutral-500 mt-1">ID: <span className="font-mono">{house.id}</span></div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-neutral-600">Aforo</div>
                  <div className="mt-1">{house.maxGuests ?? "—"}</div>
                </div>
              </div>

              {/* Editor de precios */}
              <div className="p-4 rounded-xl border bg-white">
                <div className="text-sm font-semibold">Editar precios por día</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(Object.keys(WEEK_LABEL) as Weekday[]).map((key) => (
                    <div key={key}>
                      <label className="block text-xs text-neutral-600">{WEEK_LABEL[key]}</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={form[key]}
                        onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
                        className="mt-1 w-full rounded-md border p-2"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      // Normalizamos y guardamos
                      savePrices();
                    }}
                    disabled={saving}
                    className="rounded-md bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                  >
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!house) return;
                      setForm({
                        monday: house.pricePerNight.monday !== undefined ? String(house.pricePerNight.monday) : "",
                        tuesday: house.pricePerNight.tuesday !== undefined ? String(house.pricePerNight.tuesday) : "",
                        wednesday: house.pricePerNight.wednesday !== undefined ? String(house.pricePerNight.wednesday) : "",
                        thursday: house.pricePerNight.thursday !== undefined ? String(house.pricePerNight.thursday) : "",
                        friday: house.pricePerNight.friday !== undefined ? String(house.pricePerNight.friday) : "",
                        saturday: house.pricePerNight.saturday !== undefined ? String(house.pricePerNight.saturday) : "",
                        sunday: house.pricePerNight.sunday !== undefined ? String(house.pricePerNight.sunday) : "",
                      });
                      setSaveMsg(null);
                    }}
                    className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50"
                  >
                    Deshacer cambios
                  </button>
                </div>
                {saveMsg && <div className="mt-2 text-xs whitespace-pre-wrap">{saveMsg}</div>}
              </div>

              {/* Imágenes */}
              {!!(house.images?.length) && (
                <div className="p-4 rounded-xl border bg-white">
                  <div className="text-sm font-semibold">Imágenes</div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {house.images!.map((src, i) => (
                      <div key={i} className="aspect-video overflow-hidden rounded-lg border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="w-full h-full object-cover" />
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
