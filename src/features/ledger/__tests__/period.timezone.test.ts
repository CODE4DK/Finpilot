import { dayPeriod, monthPeriod, toLocalDayKey, toLocalMonthKey } from '@/features/ledger/period';

/**
 * Boundary rules that must hold in *any* timezone.
 *
 * Jest sandboxes `process.env`, so changing TZ mid-run does not reach `Date` -
 * the zone has to be set before the process starts. `npm run test:timezones`
 * runs this file under IST, UTC, New York (negative offset with DST) and
 * Chatham (a 12:45 offset), and `npm test` runs it once in the ambient zone.
 *
 * So the assertions here are invariants rather than fixed expectations, and
 * the DST cases detect whether the current zone actually shifts rather than
 * assuming it does.
 */

const ZONE = process.env.TZ ?? 'system default';

/** Does this zone change its offset between these two dates? */
function observesDstBetween(a: Date, b: Date): boolean {
  return a.getTimezoneOffset() !== b.getTimezoneOffset();
}

describe(`period boundaries in ${ZONE}`, () => {
  it('keeps a day key aligned with the local calendar date', () => {
    const date = new Date(2026, 8, 19, 13, 0);
    expect(toLocalDayKey(date)).toBe('2026-09-19');
    expect(date.getDate()).toBe(19);
  });

  it('groups a late-evening transaction into the local day, not the UTC one', () => {
    // 23:30 local is already tomorrow in UTC for any positive offset.
    expect(toLocalDayKey(new Date(2026, 8, 19, 23, 30))).toBe('2026-09-19');
  });

  it('groups an early-morning transaction into the local day', () => {
    // 00:30 local is still yesterday in UTC for any negative offset.
    expect(toLocalDayKey(new Date(2026, 8, 19, 0, 30))).toBe('2026-09-19');
  });

  it('runs a day period from local midnight to local midnight', () => {
    const { from, to } = dayPeriod(new Date(2026, 8, 19, 23, 30));

    expect(new Date(from).getHours()).toBe(0);
    expect(toLocalDayKey(new Date(from))).toBe('2026-09-19');
    expect(toLocalDayKey(new Date(to))).toBe('2026-09-20');
  });

  it('contains every instant of its day and nothing outside it', () => {
    const { from, to } = dayPeriod(new Date(2026, 8, 19, 12, 0));
    const firstMoment = new Date(2026, 8, 19, 0, 0, 0, 0).toISOString();
    const lastMoment = new Date(2026, 8, 19, 23, 59, 59, 999).toISOString();
    const nextDay = new Date(2026, 8, 20, 0, 0, 0, 0).toISOString();

    expect(firstMoment >= from && firstMoment < to).toBe(true);
    expect(lastMoment >= from && lastMoment < to).toBe(true);
    expect(nextDay >= to).toBe(true);
  });

  it('runs a month period between local month boundaries', () => {
    const { from, to } = monthPeriod(new Date(2026, 8, 19));

    expect(toLocalDayKey(new Date(from))).toBe('2026-09-01');
    expect(toLocalDayKey(new Date(to))).toBe('2026-10-01');
  });

  it('covers consecutive months with no gap and no overlap', () => {
    for (let month = 0; month < 12; month += 1) {
      const current = monthPeriod(new Date(2026, month, 15));
      const next = monthPeriod(new Date(2026, month + 1, 15));
      expect(current.to).toBe(next.from);
    }
  });

  it('gives every month of the year a distinct key', () => {
    const keys = new Set<string>();
    for (let month = 0; month < 12; month += 1) {
      keys.add(toLocalMonthKey(new Date(2026, month, 15)));
    }
    expect(keys.size).toBe(12);
  });

  it('spans 29 days across February in a leap year', () => {
    const { from, to } = monthPeriod(new Date(2024, 1, 15));
    const hours = (new Date(to).getTime() - new Date(from).getTime()) / 3600000;

    // Allow an hour either way for a zone that shifts during February.
    expect(Math.round(hours / 24)).toBe(29);
  });

  it('spans 28 days across February in a non-leap year', () => {
    const { from, to } = monthPeriod(new Date(2026, 1, 15));
    expect(Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)).toBe(28);
  });

  it('produces one distinct day key per calendar day across a month', () => {
    const keys = new Set<string>();
    for (let day = 1; day <= 31; day += 1) {
      keys.add(toLocalDayKey(new Date(2026, 9, day, 12, 0)));
    }
    expect(keys.size).toBe(31);
  });
});

describe(`daylight saving in ${ZONE}`, () => {
  const beforeAutumnShift = new Date(2026, 9, 25, 12, 0);
  const afterAutumnShift = new Date(2026, 10, 15, 12, 0);
  const beforeSpringShift = new Date(2026, 1, 15, 12, 0);
  const afterSpringShift = new Date(2026, 3, 15, 12, 0);

  it('keeps day keys distinct through an autumn transition', () => {
    const keys = new Set<string>();
    for (let day = 0; day < 24; day += 1) {
      keys.add(toLocalDayKey(new Date(2026, 9, 20 + day, 12, 0)));
    }
    expect(keys.size).toBe(24);
  });

  it('makes a shifting day longer or shorter, and a fixed zone exactly 24 hours', () => {
    const shiftsInAutumn = observesDstBetween(beforeAutumnShift, afterAutumnShift);
    const shiftsInSpring = observesDstBetween(beforeSpringShift, afterSpringShift);

    // Find the longest and shortest day of the year in this zone.
    const lengths: number[] = [];
    for (let month = 0; month < 12; month += 1) {
      for (let day = 1; day <= 28; day += 1) {
        const { from, to } = dayPeriod(new Date(2026, month, day, 12, 0));
        lengths.push((new Date(to).getTime() - new Date(from).getTime()) / 3600000);
      }
    }

    if (shiftsInAutumn || shiftsInSpring) {
      // A DST zone has at least one day that is not 24 hours long.
      expect(lengths.some((hours) => hours !== 24)).toBe(true);
    } else {
      expect(lengths.every((hours) => hours === 24)).toBe(true);
    }
  });

  it('never loses a transaction at an ambiguous or skipped hour', () => {
    // Whatever the zone does, every instant of a day falls inside that day's
    // period - the property the transaction list depends on.
    for (let month = 0; month < 12; month += 1) {
      const { from, to } = dayPeriod(new Date(2026, month, 1, 12, 0));
      const middleOfNight = new Date(2026, month, 1, 1, 30).toISOString();

      expect(middleOfNight >= from).toBe(true);
      expect(middleOfNight < to).toBe(true);
    }
  });
});
