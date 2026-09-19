/**
 * The report period selector.
 *
 * Every preset resolves to whole **local** calendar months, so the trend chart
 * has clean buckets and "last 3 months" means three months on a calendar, not
 * ninety days measured backwards from a Tuesday afternoon. Boundaries come
 * from `@/features/ledger/period`, which is where the device-local timezone
 * decision is documented.
 */

import {
  endOfLocalDay,
  monthPeriod,
  shiftMonth,
  startOfLocalDay,
  startOfLocalMonth,
  startOfNextLocalMonth,
  toLocalMonthKey,
  type Period,
} from '@/features/ledger/period';

export const REPORT_PRESETS = [
  'this-month',
  'last-month',
  'last-3-months',
  'last-6-months',
  'last-12-months',
  'custom',
] as const;

export type ReportPreset = (typeof REPORT_PRESETS)[number];

/** How many whole months a preset spans, ending with the current month. */
const TRAILING_MONTHS: Partial<Record<ReportPreset, number>> = {
  'last-3-months': 3,
  'last-6-months': 6,
  'last-12-months': 12,
};

export const PRESET_LABELS: Record<ReportPreset, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-3-months': '3 months',
  'last-6-months': '6 months',
  'last-12-months': '12 months',
  custom: 'Custom',
};

/** A user-picked window, held as local dates and widened to whole days. */
export interface CustomRange {
  start: Date;
  end: Date;
}

export interface ReportPeriod extends Period {
  preset: ReportPreset;
  /** "September 2026", "Jun - Sep 2026" - the heading above the charts. */
  label: string;
  /** Whether the window is still filling up, for the daily average. */
  includesToday: boolean;
}

export function resolveReportPeriod(
  preset: ReportPreset,
  now: Date = new Date(),
  custom?: CustomRange,
): ReportPeriod {
  if (preset === 'custom') {
    if (!custom) {
      // No range picked yet - fall back rather than render an empty screen.
      return resolveReportPeriod('this-month', now);
    }
    const [start, end] =
      custom.start <= custom.end ? [custom.start, custom.end] : [custom.end, custom.start];
    const from = startOfLocalDay(start);
    const to = endOfLocalDay(end);
    return {
      preset,
      from: from.toISOString(),
      to: to.toISOString(),
      label: `${formatDayLabel(from)} - ${formatDayLabel(end)}`,
      includesToday: now >= from && now < to,
    };
  }

  if (preset === 'last-month') {
    const month = shiftMonth(now, -1);
    return {
      preset,
      ...monthPeriod(month),
      label: formatMonthYear(month),
      includesToday: false,
    };
  }

  if (preset === 'this-month') {
    return {
      preset,
      ...monthPeriod(now),
      label: formatMonthYear(now),
      includesToday: true,
    };
  }

  const months = TRAILING_MONTHS[preset] ?? 1;
  const first = shiftMonth(now, -(months - 1));
  return {
    preset,
    from: startOfLocalMonth(first).toISOString(),
    to: startOfNextLocalMonth(now).toISOString(),
    label:
      first.getFullYear() === now.getFullYear()
        ? `${formatMonthShort(first)} - ${formatMonthShort(now)} ${now.getFullYear()}`
        : `${formatMonthShort(first)} ${first.getFullYear()} - ${formatMonthShort(now)} ${now.getFullYear()}`,
    includesToday: true,
  };
}

export interface MonthBucket {
  /** "2026-09" - the key the monthly query groups on. */
  key: string;
  /** "Sep" - the bar's axis label. */
  label: string;
  /** Half-open UTC bounds for that local month. */
  from: string;
  to: string;
}

/**
 * The months a period covers, oldest first. A partial month at either end
 * still gets a bucket, clipped to the period so the totals stay honest.
 */
export function monthBuckets(period: Period): MonthBucket[] {
  const start = new Date(period.from);
  const end = new Date(period.to);
  const buckets: MonthBucket[] = [];

  // A 12-month window shows "Sep" twice, so year-stamp the labels whenever
  // the period crosses a new year.
  const spansYears = start.getFullYear() !== new Date(end.getTime() - 1).getFullYear();

  let cursor = startOfLocalMonth(start);
  // A period that starts mid-month belongs to the month it starts in.
  while (cursor < end && buckets.length < 24) {
    const next = startOfNextLocalMonth(cursor);
    const from = cursor < start ? start : cursor;
    const to = next > end ? end : next;
    buckets.push({
      key: toLocalMonthKey(cursor),
      label: spansYears ? formatMonthShortWithYear(cursor) : formatMonthShort(cursor),
      from: from.toISOString(),
      to: to.toISOString(),
    });
    cursor = next;
  }

  return buckets;
}

/**
 * The window immediately before `period`, of the same length in months - what
 * the month-over-month comparison measures against.
 */
export function precedingPeriod(period: Period): Period {
  const buckets = monthBuckets(period);
  const months = Math.max(buckets.length, 1);
  const start = new Date(period.from);
  const previousStart = shiftMonth(startOfLocalMonth(start), -months);
  return {
    from: previousStart.toISOString(),
    to: startOfLocalMonth(start).toISOString(),
  };
}

/**
 * Days the period has actually seen - the denominator of the daily average.
 * A month in progress divides by the days lived so far, not by 30, or the
 * average reads low for the whole month and jumps on the last day.
 */
export function elapsedDays(period: ReportPeriod, now: Date = new Date()): number {
  const from = new Date(period.from);
  const end =
    period.includesToday && now < new Date(period.to) ? endOfLocalDay(now) : new Date(period.to);
  const ms = end.getTime() - from.getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatMonthShort(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'short' });
}

function formatMonthShortWithYear(date: Date): string {
  return `${formatMonthShort(date)} '${`${date.getFullYear()}`.slice(2)}`;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
