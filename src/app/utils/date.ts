// utils/date.ts (o directamente en el componente)
const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

export function toLocalDateString(dateLike: string | Date): string {
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}