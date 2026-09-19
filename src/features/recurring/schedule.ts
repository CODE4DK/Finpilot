import type { RecurrenceFrequency } from '@/db/enums';

/**
 * When a recurring rule fires next.
 *
 * The interesting case is monthly on the 29th, 30th or 31st. A naive
 * "add one month" drifts: 31 Jan + 1 month is 31 Feb, which JavaScript rolls
 * forward to 3 March, and from then on the rule runs on the 3rd forever.
 *
 * So the rule keeps an **anchor day** - the day-of-month it was created on -
 * and each occurrence is clamped to the length of its own month. A rule
 * anchored on the 31st runs 31 Jan, 28 Feb, 31 Mar: short months clamp, and
 * the following month returns to 31.
 */

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** The day-of-month a rule should try to fire on. */
export function anchorDayOf(date: Date): number {
  return date.getDate();
}

/**
 * Builds a date in `year`/`monthIndex` on `anchorDay`, clamped to the last day
 * of that month, keeping the time of day from `template`.
 */
export function clampToMonth(
  year: number,
  monthIndex: number,
  anchorDay: number,
  template: Date,
): Date {
  const day = Math.min(anchorDay, daysInMonth(year, monthIndex));
  return new Date(
    year,
    monthIndex,
    day,
    template.getHours(),
    template.getMinutes(),
    template.getSeconds(),
    template.getMilliseconds(),
  );
}

export interface AdvanceOptions {
  frequency: RecurrenceFrequency;
  /** Every `interval` periods. 2 + 'weekly' is fortnightly. */
  interval?: number;
  /** Day-of-month to aim for; defaults to the day of `from`. */
  anchorDay?: number;
}

/** The occurrence after `from`. */
export function advance(from: Date, options: AdvanceOptions): Date {
  const { frequency, interval = 1, anchorDay = anchorDayOf(from) } = options;

  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error(`Recurrence interval must be a positive integer, received: ${interval}`);
  }

  switch (frequency) {
    case 'daily':
      return new Date(
        from.getFullYear(),
        from.getMonth(),
        from.getDate() + interval,
        from.getHours(),
        from.getMinutes(),
        from.getSeconds(),
        from.getMilliseconds(),
      );

    case 'weekly':
      return new Date(
        from.getFullYear(),
        from.getMonth(),
        from.getDate() + 7 * interval,
        from.getHours(),
        from.getMinutes(),
        from.getSeconds(),
        from.getMilliseconds(),
      );

    case 'monthly':
      return clampToMonth(from.getFullYear(), from.getMonth() + interval, anchorDay, from);

    case 'yearly': {
      // 29 February is the yearly equivalent of the 31st: clamp to 28 in a
      // common year, and return to 29 at the next leap year.
      const target = new Date(from.getFullYear() + interval, from.getMonth(), 1);
      return clampToMonth(target.getFullYear(), target.getMonth(), anchorDay, from);
    }

    default: {
      const exhaustive: never = frequency;
      throw new Error(`Unknown recurrence frequency: ${String(exhaustive)}`);
    }
  }
}

/** Stops a rule abandoned for years from producing thousands of rows at launch. */
export const MAX_CATCH_UP_OCCURRENCES = 200;

export interface OccurrenceOptions extends AdvanceOptions {
  /** First occurrence, inclusive. */
  from: Date;
  /** Generate occurrences up to and including this instant. */
  until: Date;
  /** The rule's end date, if it has one. */
  endAt?: Date | null;
  max?: number;
}

export interface OccurrenceResult {
  occurrences: Date[];
  /** Where `next_run_at` should be left afterwards. */
  nextRunAt: Date | null;
  /** True when the cap stopped generation early. */
  truncated: boolean;
}

/**
 * Every occurrence from `from` up to `until`, plus where the rule should sit
 * afterwards. `nextRunAt` is null once the rule has passed its end date.
 */
export function occurrencesUpTo(options: OccurrenceOptions): OccurrenceResult {
  const {
    from,
    until,
    endAt = null,
    frequency,
    interval = 1,
    anchorDay = anchorDayOf(from),
    max = MAX_CATCH_UP_OCCURRENCES,
  } = options;

  const occurrences: Date[] = [];
  let cursor = from;
  let truncated = false;

  while (cursor.getTime() <= until.getTime()) {
    if (endAt && cursor.getTime() > endAt.getTime()) {
      return { occurrences, nextRunAt: null, truncated };
    }

    occurrences.push(cursor);

    if (occurrences.length >= max) {
      truncated = true;
      break;
    }

    cursor = advance(cursor, { frequency, interval, anchorDay });
  }

  const nextRunAt = truncated ? advance(cursor, { frequency, interval, anchorDay }) : cursor;

  if (endAt && nextRunAt.getTime() > endAt.getTime()) {
    return { occurrences, nextRunAt: null, truncated };
  }

  return { occurrences, nextRunAt, truncated };
}

/** Human summary for the rule list: "Every 2 weeks", "Monthly on the 31st". */
export function describeRecurrence(
  frequency: RecurrenceFrequency,
  interval = 1,
  anchorDay?: number,
): string {
  const every = interval === 1 ? '' : ` ${interval}`;

  switch (frequency) {
    case 'daily':
      return interval === 1 ? 'Every day' : `Every${every} days`;
    case 'weekly':
      return interval === 1 ? 'Every week' : `Every${every} weeks`;
    case 'monthly': {
      const base = interval === 1 ? 'Every month' : `Every${every} months`;
      return anchorDay ? `${base} on the ${ordinal(anchorDay)}` : base;
    }
    case 'yearly':
      return interval === 1 ? 'Every year' : `Every${every} years`;
    default:
      return 'Repeats';
  }
}

export function ordinal(day: number): string {
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? 'th'
      : day % 10 === 1
        ? 'st'
        : day % 10 === 2
          ? 'nd'
          : day % 10 === 3
            ? 'rd'
            : 'th';
  return `${day}${suffix}`;
}
