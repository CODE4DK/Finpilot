import { endOfMonth, nowIso, startOfMonth, toLocalDateKey, toMonthKey } from '@/utils/date';

describe('nowIso', () => {
  it('returns an ISO-8601 UTC timestamp', () => {
    expect(nowIso(new Date(Date.UTC(2026, 8, 19, 10, 30, 0)))).toBe('2026-09-19T10:30:00.000Z');
  });
});

describe('date keys', () => {
  const date = new Date(2026, 8, 5, 13, 0, 0);

  it('zero-pads the local date key', () => {
    expect(toLocalDateKey(date)).toBe('2026-09-05');
  });

  it('derives the month key', () => {
    expect(toMonthKey(date)).toBe('2026-09');
  });
});

describe('month boundaries', () => {
  it('finds the first and last instant of the month', () => {
    const date = new Date(2026, 1, 14, 9, 0, 0);
    expect(toLocalDateKey(startOfMonth(date))).toBe('2026-02-01');
    expect(toLocalDateKey(endOfMonth(date))).toBe('2026-02-28');
    expect(endOfMonth(date).getMilliseconds()).toBe(999);
  });
});
