/**
 * Locale-aware dates. `toLocaleDateString()` with no locale prints US-style
 * "10/25/2026" on many phones; Indian sellers expect "25 Oct 2026" (or the
 * Hindi month name).
 */
type DateInput = Date | string | number;

function toDate(d: DateInput): Date {
  return d instanceof Date ? d : new Date(d);
}

function locale(isHi: boolean): string {
  return isHi ? "hi-IN" : "en-IN";
}

export function formatDate(d: DateInput, isHi: boolean): string {
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale(isHi), { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(d: DateInput, isHi: boolean): string {
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale(isHi), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
