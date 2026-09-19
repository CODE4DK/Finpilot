import {
  dayPeriod,
  formatDayHeading,
  formatMonthLabel,
  isSameLocalDay,
  monthPeriod,
  shiftMonth,
  startOfLocalDay,
  startOfLocalMonth,
  startOfNextLocalMonth,
  toLocalDayKey,
  toLocalMonthKey,
  toMonthStartKey,
  trailingPeriod,
} from '@/features/ledger/period';

describe('local keys', () => {
  it('zero-pads the day key', () => {
    expect(toLocalDayKey(new Date(2026, 8, 5, 13, 0))).toBe('2026-09-05');
    expect(toLocalDayKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('derives the month keys', () => {
    const date = new Date(2026, 8, 19, 13, 0);
    expect(toLocalMonthKey(date)).toBe('2026-09');
    expect(toMonthStartKey(date)).toBe('2026-09-01');
  });
});

describe('local boundaries', () => {
  it('starts a day at local midnight', () => {
    const start = startOfLocalDay(new Date(2026, 8, 19, 23, 45));
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(toLocalDayKey(start)).toBe('2026-09-19');
  });

  it('starts a month on the 1st', () => {
    expect(toLocalDayKey(startOfLocalMonth(new Date(2026, 8, 19)))).toBe('2026-09-01');
  });

  it('rolls the next month over the year boundary', () => {
    expect(toLocalDayKey(startOfNextLocalMonth(new Date(2026, 11, 15)))).toBe('2027-01-01');
  });

  it('shifts months in both directions', () => {
    const september = new Date(2026, 8, 19);
    expect(toLocalMonthKey(shiftMonth(september, -1))).toBe('2026-08');
    expect(toLocalMonthKey(shiftMonth(september, 1))).toBe('2026-10');
    expect(toLocalMonthKey(shiftMonth(september, -9))).toBe('2025-12');
  });
});

describe('periods', () => {
  it('describes a day as a half-open range', () => {
    const { from, to } = dayPeriod(new Date(2026, 8, 19, 15, 30));

    expect(from).toBe(startOfLocalDay(new Date(2026, 8, 19)).toISOString());
    expect(to).toBe(startOfLocalDay(new Date(2026, 8, 20)).toISOString());
    // Half-open: a transaction at exactly midnight belongs to the next day.
    expect(from < to).toBe(true);
  });

  it('describes a month as a half-open range', () => {
    const { from, to } = monthPeriod(new Date(2026, 8, 19));

    expect(from).toBe(new Date(2026, 8, 1).toISOString());
    expect(to).toBe(new Date(2026, 9, 1).toISOString());
  });

  it('handles February in a leap year', () => {
    const { from, to } = monthPeriod(new Date(2024, 1, 15));

    expect(from).toBe(new Date(2024, 1, 1).toISOString());
    expect(to).toBe(new Date(2024, 2, 1).toISOString());
    // 29 days in 2024.
    const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
    expect(days).toBe(29);
  });

  it('handles February in a non-leap year', () => {
    const { from, to } = monthPeriod(new Date(2026, 1, 15));
    const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
    expect(days).toBe(28);
  });

  it('spans a December-to-January boundary', () => {
    const { from, to } = monthPeriod(new Date(2026, 11, 31, 23, 59));

    expect(from).toBe(new Date(2026, 11, 1).toISOString());
    expect(to).toBe(new Date(2027, 0, 1).toISOString());
  });

  it('builds a trailing window that includes today', () => {
    const now = new Date(2026, 8, 19, 15, 0);
    const { from, to } = trailingPeriod(7, now);

    expect(from).toBe(startOfLocalDay(new Date(2026, 8, 13)).toISOString());
    expect(to).toBe(startOfLocalDay(new Date(2026, 8, 20)).toISOString());
  });
});

describe('isSameLocalDay', () => {
  it('compares by local day, not by instant', () => {
    expect(isSameLocalDay(new Date(2026, 8, 19, 0, 1), new Date(2026, 8, 19, 23, 59))).toBe(true);
    expect(isSameLocalDay(new Date(2026, 8, 19, 23, 59), new Date(2026, 8, 20, 0, 1))).toBe(false);
  });
});

describe('formatDayHeading', () => {
  const now = new Date(2026, 8, 19, 12, 0);

  it('names today and yesterday', () => {
    expect(formatDayHeading('2026-09-19', now)).toBe('Today');
    expect(formatDayHeading('2026-09-18', now)).toBe('Yesterday');
  });

  it('handles yesterday across a month boundary', () => {
    expect(formatDayHeading('2026-08-31', new Date(2026, 8, 1, 12, 0))).toBe('Yesterday');
  });

  it('formats an older day without the year when it is this year', () => {
    const heading = formatDayHeading('2026-09-01', now);
    expect(heading).toContain('Sep');
    expect(heading).not.toContain('2026');
  });

  it('includes the year for a different year', () => {
    expect(formatDayHeading('2025-09-01', now)).toContain('2025');
  });

  it('parses the key as a local day, not a UTC instant', () => {
    // Naively, new Date('2026-09-19') is UTC midnight, which is the previous
    // day in any negative-offset zone.
    expect(formatDayHeading('2026-09-19', new Date(2026, 8, 19, 12, 0))).toBe('Today');
  });
});

describe('formatMonthLabel', () => {
  it('names the month and year', () => {
    const label = formatMonthLabel(new Date(2026, 8, 1));
    expect(label).toContain('September');
    expect(label).toContain('2026');
  });
});
