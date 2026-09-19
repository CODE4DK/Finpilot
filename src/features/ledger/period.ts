/**
 * Period boundaries.
 *
 * Transactions are stored as UTC instants (`occurred_at`), but a user thinks
 * in local days and months: "today's spending" means the day they are living
 * in, not a UTC window. Everything here converts between the two.
 *
 * On the timezone the app groups by: this uses the **device's** local zone.
 * `profiles.timezone` exists and is shown in settings, but Hermes on Android
 * ships a trimmed ICU, so `Intl.DateTimeFormat` with an arbitrary `timeZone`
 * cannot be relied on for the grouping path on device. That is correct for a
 * user on their own phone in their own country, and wrong only for someone
 * travelling who expects home-time grouping. Revisit with a tz library.
 */

export interface Period {
  /** Inclusive UTC instant, ISO-8601. */
  from: string;
  /** Exclusive UTC instant, ISO-8601. */
  to: string;
}

/** "2026-09-19" in local time - the key a day group is built on. */
export function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** "2026-09" - the key monthly summaries are built on. */
export function toLocalMonthKey(date: Date): string {
  return toLocalDayKey(date).slice(0, 7);
}

/** First day of the month, as budgets store it: "2026-09-01". */
export function toMonthStartKey(date: Date): string {
  return `${toLocalMonthKey(date)}-01`;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

export function startOfLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function startOfNextLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
}

/** The local day as a half-open UTC range, ready for a SQL filter. */
export function dayPeriod(date: Date): Period {
  return {
    from: startOfLocalDay(date).toISOString(),
    to: endOfLocalDay(date).toISOString(),
  };
}

/** The local month as a half-open UTC range. */
export function monthPeriod(date: Date): Period {
  return {
    from: startOfLocalMonth(date).toISOString(),
    to: startOfNextLocalMonth(date).toISOString(),
  };
}

/** `offset` months from `date`: -1 is last month, +1 is next. */
export function shiftMonth(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1, 0, 0, 0, 0);
}

/** A rolling window ending now, for "last 30 days" style views. */
export function trailingPeriod(days: number, now: Date = new Date()): Period {
  const start = startOfLocalDay(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1),
  );
  return { from: start.toISOString(), to: endOfLocalDay(now).toISOString() };
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return toLocalDayKey(a) === toLocalDayKey(b);
}

/** "Today" / "Yesterday" / "Mon, 19 Sep" - the day-group heading. */
export function formatDayHeading(dayKey: string, now: Date = new Date()): string {
  const todayKey = toLocalDayKey(now);
  const yesterdayKey = toLocalDayKey(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  );

  if (dayKey === todayKey) {
    return 'Today';
  }
  if (dayKey === yesterdayKey) {
    return 'Yesterday';
  }

  // Parse as local midnight rather than letting Date treat it as UTC.
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(year!, (month ?? 1) - 1, day ?? 1);

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "September 2026" - the month picker's label. */
export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
