import {
  elapsedDays,
  monthBuckets,
  precedingPeriod,
  resolveReportPeriod,
} from '@/features/reports/periods';

/** Mid-month, so a "this month" window is genuinely partial. */
const NOW = new Date(2026, 8, 19, 15, 30); // 19 Sep 2026, local

describe('resolveReportPeriod', () => {
  it('bounds this month as a half-open local range', () => {
    const period = resolveReportPeriod('this-month', NOW);

    expect(period.from).toBe(new Date(2026, 8, 1).toISOString());
    expect(period.to).toBe(new Date(2026, 9, 1).toISOString());
    expect(period.label).toContain('2026');
    expect(period.includesToday).toBe(true);
  });

  it('bounds last month and knows it is closed', () => {
    const period = resolveReportPeriod('last-month', NOW);

    expect(period.from).toBe(new Date(2026, 7, 1).toISOString());
    expect(period.to).toBe(new Date(2026, 8, 1).toISOString());
    expect(period.includesToday).toBe(false);
  });

  it('counts trailing presets in whole months, ending with this one', () => {
    const three = resolveReportPeriod('last-3-months', NOW);

    expect(three.from).toBe(new Date(2026, 6, 1).toISOString());
    expect(three.to).toBe(new Date(2026, 9, 1).toISOString());
    expect(monthBuckets(three)).toHaveLength(3);
  });

  it('crosses a year boundary without losing a month', () => {
    const twelve = resolveReportPeriod('last-12-months', NOW);

    expect(twelve.from).toBe(new Date(2025, 9, 1).toISOString());
    expect(monthBuckets(twelve)).toHaveLength(12);
  });

  it('widens a custom range to whole local days', () => {
    const period = resolveReportPeriod('custom', NOW, {
      start: new Date(2026, 8, 3, 18, 0),
      end: new Date(2026, 8, 7, 2, 0),
    });

    expect(period.from).toBe(new Date(2026, 8, 3).toISOString());
    expect(period.to).toBe(new Date(2026, 8, 8).toISOString());
  });

  it('accepts a custom range picked backwards', () => {
    const period = resolveReportPeriod('custom', NOW, {
      start: new Date(2026, 8, 7),
      end: new Date(2026, 8, 3),
    });

    expect(period.from).toBe(new Date(2026, 8, 3).toISOString());
    expect(period.to).toBe(new Date(2026, 8, 8).toISOString());
  });

  it('falls back to this month when custom has no range yet', () => {
    expect(resolveReportPeriod('custom', NOW).from).toBe(new Date(2026, 8, 1).toISOString());
  });
});

describe('monthBuckets', () => {
  it('clips a partial month at either end to the period', () => {
    const period = {
      from: new Date(2026, 7, 15).toISOString(),
      to: new Date(2026, 8, 10).toISOString(),
    };

    const buckets = monthBuckets(period);

    expect(buckets.map((bucket) => bucket.key)).toEqual(['2026-08', '2026-09']);
    expect(buckets[0]!.from).toBe(period.from);
    expect(buckets[1]!.to).toBe(period.to);
  });

  it('year-stamps the labels once the window crosses a year', () => {
    const buckets = monthBuckets(resolveReportPeriod('last-12-months', NOW));

    expect(buckets[0]!.label).toMatch(/'25$/);
    expect(new Set(buckets.map((bucket) => bucket.label)).size).toBe(12);
  });

  it('leaves labels unstamped inside one year', () => {
    const buckets = monthBuckets(resolveReportPeriod('last-3-months', NOW));

    expect(buckets.every((bucket) => !bucket.label.includes("'"))).toBe(true);
  });
});

describe('precedingPeriod', () => {
  it('is the same number of months, immediately before', () => {
    const current = resolveReportPeriod('last-3-months', NOW);
    const previous = precedingPeriod(current);

    expect(previous.to).toBe(current.from);
    expect(previous.from).toBe(new Date(2026, 3, 1).toISOString());
  });

  it('is last month for a this-month report', () => {
    const previous = precedingPeriod(resolveReportPeriod('this-month', NOW));

    expect(previous.from).toBe(new Date(2026, 7, 1).toISOString());
    expect(previous.to).toBe(new Date(2026, 8, 1).toISOString());
  });
});

describe('elapsedDays', () => {
  it('counts only the days lived so far in a month in progress', () => {
    expect(elapsedDays(resolveReportPeriod('this-month', NOW), NOW)).toBe(19);
  });

  it('counts the whole of a closed month', () => {
    expect(elapsedDays(resolveReportPeriod('last-month', NOW), NOW)).toBe(31);
  });

  it('never divides by zero', () => {
    const period = resolveReportPeriod('custom', NOW, { start: NOW, end: NOW });
    expect(elapsedDays(period, NOW)).toBe(1);
  });
});
