import {
  OVER_THRESHOLD,
  WARNING_THRESHOLD,
  daysElapsedInMonth,
  daysLeftInMonth,
  describePace,
  normaliseLimit,
  overspentPaise,
  paceRatio,
  remainingPaise,
  safeToSpendPerDay,
  summariseBudgets,
  toneFor,
  usedFraction,
  usedPercentage,
} from '@/features/budgets/budget-math';

const LIMIT = 1000000; // ₹10,000

describe('usedFraction and usedPercentage', () => {
  it('divides spend by limit', () => {
    expect(usedFraction(500000, LIMIT)).toBe(0.5);
    expect(usedPercentage(500000, LIMIT)).toBe(50);
  });

  it('reports over-spend past 100%', () => {
    expect(usedPercentage(1400000, LIMIT)).toBe(140);
  });

  it('treats a zero or negative limit as unusable rather than dividing by it', () => {
    expect(usedFraction(500000, 0)).toBe(0);
    expect(usedFraction(500000, -100)).toBe(0);
    expect(usedPercentage(500000, 0)).toBe(0);
  });

  it('is zero when nothing is spent', () => {
    expect(usedPercentage(0, LIMIT)).toBe(0);
  });
});

describe('toneFor', () => {
  it.each([
    [0, 'primary'],
    [500000, 'primary'],
    [799999, 'primary'],
    [800000, 'warning'],
    [999999, 'warning'],
    [1000000, 'expense'],
    [1400000, 'expense'],
  ] as const)('is %s at %p paise spent', (spent, tone) => {
    expect(toneFor(spent, LIMIT)).toBe(tone);
  });

  it('switches exactly on the boundaries, not near them', () => {
    expect(toneFor(LIMIT * WARNING_THRESHOLD - 1, LIMIT)).toBe('primary');
    expect(toneFor(LIMIT * WARNING_THRESHOLD, LIMIT)).toBe('warning');
    expect(toneFor(LIMIT * OVER_THRESHOLD - 1, LIMIT)).toBe('warning');
    expect(toneFor(LIMIT * OVER_THRESHOLD, LIMIT)).toBe('expense');
  });

  it('stays green for a budget with no limit, rather than reading as over', () => {
    expect(toneFor(500000, 0)).toBe('primary');
  });
});

describe('remainingPaise and overspentPaise', () => {
  it('reports what is left', () => {
    expect(remainingPaise(400000, LIMIT)).toBe(600000);
  });

  it('never reports a negative remainder', () => {
    expect(remainingPaise(1400000, LIMIT)).toBe(0);
  });

  it('reports how far over, separately', () => {
    expect(overspentPaise(1400000, LIMIT)).toBe(400000);
    expect(overspentPaise(400000, LIMIT)).toBe(0);
  });

  it('counts exactly at the limit as neither left nor over', () => {
    expect(remainingPaise(LIMIT, LIMIT)).toBe(0);
    expect(overspentPaise(LIMIT, LIMIT)).toBe(0);
  });
});

describe('daysLeftInMonth', () => {
  it('counts today, so the last day of the month is 1 and never 0', () => {
    expect(daysLeftInMonth(new Date(2026, 8, 30, 23, 0))).toBe(1);
    expect(daysLeftInMonth(new Date(2026, 0, 31, 12, 0))).toBe(1);
  });

  it('counts the whole month on the first', () => {
    expect(daysLeftInMonth(new Date(2026, 8, 1))).toBe(30);
    expect(daysLeftInMonth(new Date(2026, 0, 1))).toBe(31);
  });

  it('handles February in both kinds of year', () => {
    expect(daysLeftInMonth(new Date(2026, 1, 1))).toBe(28);
    expect(daysLeftInMonth(new Date(2024, 1, 1))).toBe(29);
  });

  it('counts elapsed days as the day of the month', () => {
    expect(daysElapsedInMonth(new Date(2026, 8, 19))).toBe(19);
  });
});

describe('safeToSpendPerDay', () => {
  it('spreads what is left over the days remaining', () => {
    // ₹6,000 left, 10 days including today.
    expect(safeToSpendPerDay(400000, LIMIT, new Date(2026, 8, 21))).toBe(60000);
  });

  it('is zero once the budget is spent, never negative', () => {
    expect(safeToSpendPerDay(1400000, LIMIT, new Date(2026, 8, 21))).toBe(0);
  });

  it('gives the whole remainder on the last day', () => {
    expect(safeToSpendPerDay(400000, LIMIT, new Date(2026, 8, 30))).toBe(600000);
  });

  it('returns whole paise, never a fraction', () => {
    const perDay = safeToSpendPerDay(0, 1000, new Date(2026, 8, 28));
    expect(Number.isInteger(perDay)).toBe(true);
  });
});

describe('paceRatio', () => {
  it('is 1 when spending exactly matches the day of the month', () => {
    // Half the month gone, half the budget spent.
    expect(paceRatio(500000, LIMIT, new Date(2026, 8, 15))).toBeCloseTo(1, 1);
  });

  it('is above 1 when spending is running ahead', () => {
    expect(paceRatio(900000, LIMIT, new Date(2026, 8, 15))).toBeGreaterThan(1);
  });

  it('is below 1 when spending is behind', () => {
    expect(paceRatio(100000, LIMIT, new Date(2026, 8, 15))).toBeLessThan(1);
  });

  it('is zero for a budget with no limit', () => {
    expect(paceRatio(500000, 0, new Date(2026, 8, 15))).toBe(0);
  });
});

describe('describePace', () => {
  it('says how many days are left', () => {
    expect(describePace(400000, LIMIT, new Date(2026, 8, 21))).toBe('10 days left');
  });

  it('uses the singular on the last day', () => {
    expect(describePace(400000, LIMIT, new Date(2026, 8, 30))).toBe('1 day left');
  });

  it('says plainly when the budget is gone', () => {
    expect(describePace(1400000, LIMIT, new Date(2026, 8, 21))).toBe('Over budget');
  });

  it('warns when there is nothing left but the budget is not exceeded', () => {
    expect(describePace(LIMIT, LIMIT, new Date(2026, 8, 21))).toContain('nothing left');
  });
});

describe('summariseBudgets', () => {
  const budgets = [
    { id: 'a', category_id: 'food', limit_paise: 1000000, spent_paise: 850000 },
    { id: 'b', category_id: 'transport', limit_paise: 500000, spent_paise: 100000 },
    { id: 'c', category_id: 'shopping', limit_paise: 1000000, spent_paise: 1260000 },
  ];

  it('totals limits and spending', () => {
    const summary = summariseBudgets(budgets, new Date(2026, 8, 21));

    expect(summary.limitPaise).toBe(2500000);
    expect(summary.spentPaise).toBe(2210000);
  });

  it('counts how many are over and how many are close', () => {
    const summary = summariseBudgets(budgets, new Date(2026, 8, 21));

    expect(summary.overCount).toBe(1);
    expect(summary.warningCount).toBe(1);
  });

  it('carries the days left and the daily allowance', () => {
    const summary = summariseBudgets(budgets, new Date(2026, 8, 21));

    expect(summary.daysLeft).toBe(10);
    expect(summary.safeToSpendPerDayPaise).toBe(29000);
  });

  it('handles a month with no budgets', () => {
    const summary = summariseBudgets([], new Date(2026, 8, 21));

    expect(summary.limitPaise).toBe(0);
    expect(summary.tone).toBe('primary');
    expect(summary.safeToSpendPerDayPaise).toBe(0);
  });
});

describe('normaliseLimit', () => {
  it('keeps a positive limit', () => {
    expect(normaliseLimit(1000000)).toBe(1000000);
  });

  it('rejects zero and negative limits, which the database would refuse', () => {
    expect(normaliseLimit(0)).toBeNull();
    expect(normaliseLimit(-100)).toBeNull();
  });

  it('passes null through', () => {
    expect(normaliseLimit(null)).toBeNull();
  });
});
