/**
 * The edge cases from docs/TEST_PLAN.md, run rather than described.
 *
 * Each of these is a case a finance app gets quietly wrong: a month boundary
 * that puts a transaction in the wrong month, an amount that rounds the wrong
 * way, a name that breaks an export. They are gathered here, across features,
 * because they are the cases that cross feature boundaries.
 */

import { periodTotals } from '@/features/ledger/balances';
import { groupByDay } from '@/features/ledger/grouping';
import { monthPeriod } from '@/features/ledger/period';
import { advance } from '@/features/recurring/schedule';
import { buildCategorySlices } from '@/features/reports/aggregate';
import { buildCsv } from '@/features/reports/csv';
import { monthBuckets, resolveReportPeriod } from '@/features/reports/periods';
import { formatINR, parseAmountToPaise, rupeesToPaise } from '@/utils/money';

describe('E-05 - Indian digit grouping', () => {
  it('groups in lakhs and crores, not in thousands', () => {
    expect(formatINR(1_00_000_00)).toBe('₹1,00,000.00');
    expect(formatINR(1_00_00_000_00)).toBe('₹1,00,00,000.00');
    expect(formatINR(999_00)).toBe('₹999.00');
  });

  it('groups a negative amount the same way', () => {
    expect(formatINR(-1_00_000_00)).toBe('-₹1,00,000.00');
  });
});

describe('E-04 - fractional paise', () => {
  it('rounds half away from zero, in both directions', () => {
    expect(rupeesToPaise(10.005)).toBe(1001);
    expect(rupeesToPaise(-10.005)).toBe(-1001);
  });

  it('never produces a fraction of a paisa', () => {
    for (const rupees of [0.1, 0.2, 1.005, 99.999, 12345.678]) {
      expect(Number.isSafeInteger(rupeesToPaise(rupees))).toBe(true);
    }
  });
});

describe('E-01 to E-03 - the amount bounds', () => {
  it('parses zero, and refuses nonsense', () => {
    expect(parseAmountToPaise('0')).toBe(0);
    expect(parseAmountToPaise('')).toBeNull();
    expect(parseAmountToPaise('abc')).toBeNull();
    expect(parseAmountToPaise('1.2.3')).toBeNull();
  });

  it('refuses an amount too large to stay exact, without throwing', () => {
    expect(() => parseAmountToPaise('9'.repeat(25))).not.toThrow();
    expect(parseAmountToPaise('9'.repeat(25))).toBeNull();
  });
});

describe('E-07 - the month boundary', () => {
  it('puts 23:59 on the last of the month in that month', () => {
    const lastMoment = new Date(2026, 8, 30, 23, 59, 59);
    const september = monthPeriod(lastMoment);

    expect(lastMoment.toISOString() >= september.from).toBe(true);
    expect(lastMoment.toISOString() < september.to).toBe(true);
  });

  it('puts 00:00 on the first in the next month, not the previous one', () => {
    const firstMoment = new Date(2026, 9, 1, 0, 0, 0);

    expect(firstMoment.toISOString() < monthPeriod(new Date(2026, 8, 15)).to).toBe(false);
    expect(firstMoment.toISOString() >= monthPeriod(firstMoment).from).toBe(true);
  });

  it('groups those two into different days', () => {
    const groups = groupByDay([
      {
        id: 'a',
        type: 'expense',
        amount_paise: 1000,
        account_id: 'acc',
        to_account_id: null,
        occurred_at: new Date(2026, 8, 30, 23, 59).toISOString(),
        deleted_at: null,
      },
      {
        id: 'b',
        type: 'expense',
        amount_paise: 1000,
        account_id: 'acc',
        to_account_id: null,
        occurred_at: new Date(2026, 9, 1, 0, 1).toISOString(),
        deleted_at: null,
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.dayKey)).toEqual(['2026-10-01', '2026-09-30']);
  });
});

describe('E-08 - the year boundary', () => {
  it('spans both years without merging a month', () => {
    const buckets = monthBuckets(resolveReportPeriod('last-12-months', new Date(2026, 8, 19)));

    expect(buckets).toHaveLength(12);
    expect(buckets[0]!.key).toBe('2025-10');
    expect(buckets.at(-1)!.key).toBe('2026-09');
    expect(buckets.map((bucket) => bucket.key)).toContain('2025-12');
    expect(buckets.map((bucket) => bucket.key)).toContain('2026-01');
  });

  it('keeps every label distinct across the year change', () => {
    const buckets = monthBuckets(resolveReportPeriod('last-12-months', new Date(2026, 8, 19)));

    expect(new Set(buckets.map((bucket) => bucket.label)).size).toBe(12);
  });
});

describe('E-09 and E-10 - short months and leap days', () => {
  it('walks a monthly rule from the 31st through a 30-day month and back', () => {
    const january31 = new Date(2026, 0, 31, 9, 0);

    const february = advance(january31, { frequency: 'monthly', interval: 1 });
    expect([february.getMonth(), february.getDate()]).toEqual([1, 28]);

    // The rule remembers it wants the 31st, rather than drifting to the 28th
    // for the rest of the year.
    const march = advance(february, { frequency: 'monthly', interval: 1, anchorDay: 31 });
    expect([march.getMonth(), march.getDate()]).toEqual([2, 31]);
  });

  it('moves a yearly rule on 29 February to the 28th in a common year', () => {
    const leapDay = new Date(2028, 1, 29, 9, 0);

    const next = advance(leapDay, { frequency: 'yearly', interval: 1 });

    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2029, 1, 28]);
  });
});

describe('E-17 and E-18 - text that breaks a spreadsheet', () => {
  const row = {
    occurred_at: new Date(2026, 8, 2, 12, 0).toISOString(),
    type: 'expense',
    amount_paise: 12345,
    account_name: 'HDFC',
    to_account_name: null,
  };

  it('carries Devanagari and emoji through unchanged, behind a BOM', () => {
    const csv = buildCsv([{ ...row, category_name: 'चाय ☕', note: 'सुबह की चाय' }]);

    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('चाय ☕');
    expect(csv).toContain('सुबह की चाय');
  });

  it('neutralises a note a spreadsheet would execute', () => {
    const csv = buildCsv([{ ...row, category_name: 'Food', note: "=cmd|'/c calc'!A1" }]);

    expect(csv).toContain("'=cmd");
  });

  it('quotes a note containing the delimiter, so the columns survive', () => {
    const csv = buildCsv([{ ...row, category_name: 'Food', note: 'chai, samosa, and a bun' }]);
    const [, line] = csv.split('\r\n');

    expect(line!.endsWith('"chai, samosa, and a bun"')).toBe(true);
    // Eight commas separate the nine columns; the ones inside the note sit
    // inside the quotes and do not count.
    expect(line!.split('"')[0]!.split(',')).toHaveLength(9);
  });
});

describe('E-19 - a category that no longer exists', () => {
  it('reads as Uncategorised rather than breaking the report', () => {
    const slices = buildCategorySlices(
      [
        { category_id: 'deleted-category', spent_paise: 50000, txn_count: 3 },
        { category_id: null, spent_paise: 10000, txn_count: 1 },
      ],
      [],
      'light',
    );

    expect(slices.map((slice) => slice.name)).toEqual(['Uncategorised', 'Uncategorised']);
    expect(slices.every((slice) => slice.amountPaise > 0)).toBe(true);
  });
});

describe('E-13 - nothing at all', () => {
  it('totals an empty period to zero rather than to NaN', () => {
    const totals = periodTotals([]);

    expect(totals).toMatchObject({ incomePaise: 0, expensePaise: 0, netPaise: 0 });
    expect(Number.isNaN(totals.netPaise)).toBe(false);
  });

  it('builds no slices from nothing, rather than a zero-width ring', () => {
    expect(buildCategorySlices([], [], 'light')).toEqual([]);
  });
});
