/**
 * Synced rows carry ISO-8601 UTC timestamps so that PowerSync and Postgres
 * agree regardless of the device timezone.
 */
export function nowIso(date: Date = new Date()): string {
  return date.toISOString();
}

/** "2026-09-19" in the device's local timezone - used for grouping by day. */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** "2026-09" - the month bucket most FinPilot summaries are keyed on. */
export function toMonthKey(date: Date): string {
  return toLocalDateKey(date).slice(0, 7);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}
