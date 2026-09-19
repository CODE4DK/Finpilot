import { endOfMonth, nowIso, startOfMonth, toLocalDateKey, toMonthKey } from '@/utils/date';

/**
 * The boundary between the two clocks FinPilot lives with: rows are stored as
 * UTC instants so Postgres and PowerSync agree, while a person thinks in local
 * days and months. Every function here sits on that line.
 */

describe('nowIso', () => {
  it('writes a UTC instant, which is what a synced row stores', () => {
    expect(nowIso(new Date(Date.UTC(2026, 8, 19, 10, 30)))).toBe('2026-09-19T10:30:00.000Z');
  });

  it('defaults to the clock rather than demanding one', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });
});

describe('toLocalDateKey', () => {
  it('pads the month and the day, so keys sort as strings', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('reads the local day, not the UTC one', () => {
    // Late on the 19th locally is already the 20th in UTC in some zones, and
    // the day group has to follow the person, not the server.
    const lateEvening = new Date(2026, 8, 19, 23, 30);

    expect(toLocalDateKey(lateEvening)).toBe('2026-09-19');
  });

  it('handles the last day of a year', () => {
    expect(toLocalDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('handles a leap day', () => {
    expect(toLocalDateKey(new Date(2028, 1, 29))).toBe('2028-02-29');
  });
});

describe('toMonthKey', () => {
  it('is the day key without the day', () => {
    expect(toMonthKey(new Date(2026, 8, 19))).toBe('2026-09');
    expect(toMonthKey(new Date(2026, 0, 1))).toBe('2026-01');
  });
});

describe('month boundaries', () => {
  it('starts at local midnight on the first', () => {
    const start = startOfMonth(new Date(2026, 8, 19, 15, 30));

    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(8);
    expect(start.getHours()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it('ends on the last millisecond of the last day', () => {
    const end = endOfMonth(new Date(2026, 8, 19));

    expect(end.getDate()).toBe(30);
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('knows how long February is, leap year or not', () => {
    expect(endOfMonth(new Date(2026, 1, 10)).getDate()).toBe(28);
    expect(endOfMonth(new Date(2028, 1, 10)).getDate()).toBe(29);
  });

  it('rolls into the next year from December', () => {
    const end = endOfMonth(new Date(2026, 11, 5));

    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });

  it('brackets every instant in the month it was asked about', () => {
    const middle = new Date(2026, 8, 19, 12, 0);

    expect(startOfMonth(middle).getTime()).toBeLessThan(middle.getTime());
    expect(endOfMonth(middle).getTime()).toBeGreaterThan(middle.getTime());
  });
});
