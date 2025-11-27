// utils/date.ts (o directamente en el componente)
const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

export function toLocalDateString(dateLike: string | Date): string {
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Convierte un timestamp ISO (UTC) a la hora de Lituania y lo formatea
 * para mostrar en páginas de administración.
 *
 * @param isoString - Timestamp en formato ISO (UTC), ej: "2025-11-27T19:01:19.000Z"
 * @param options - Opciones de formato
 * @returns Fecha formateada en hora de Lituania, ej: "27/11/2025, 21:01:19" o "27/11/2025"
 *
 * @example
 * formatLithuaniaTime("2025-11-27T19:01:19.000Z") // "27/11/2025, 21:01:19"
 * formatLithuaniaTime("2025-11-27T19:01:19.000Z", { dateOnly: true }) // "27/11/2025"
 */
export function formatLithuaniaTime(
  isoString: string | null | undefined,
  options: { dateOnly?: boolean; timeOnly?: boolean } = {}
): string {
  if (!isoString) return "—";

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vilnius',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(options.dateOnly ? {} : {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  });

  if (options.timeOnly) {
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Vilnius',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return timeFormatter.format(date);
  }

  return formatter.format(date);
}

/**
 * Convierte un timestamp ISO (UTC) a formato ISO en la hora de Lituania
 *
 * @param isoString - Timestamp en formato ISO (UTC)
 * @returns String ISO en formato YYYY-MM-DD HH:mm:ss (hora de Lituania)
 *
 * @example
 * toLithuaniaISO("2025-11-27T19:01:19.000Z") // "2025-11-27 21:01:19"
 */
export function toLithuaniaISO(isoString: string | null | undefined): string {
  if (!isoString) return "—";

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vilnius',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const getValue = (type: string) => parts.find(p => p.type === type)?.value || '';

  return `${getValue('year')}-${getValue('month')}-${getValue('day')} ${getValue('hour')}:${getValue('minute')}:${getValue('second')}`;
}