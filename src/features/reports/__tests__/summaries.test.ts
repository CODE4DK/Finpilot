import type { CategoryChange, CategorySlice, TrendPoint } from '@/features/reports/aggregate';
import {
  describeCategoryChange,
  describeCategoryChart,
  describeTrendChart,
} from '@/features/reports/summaries';

function slice(name: string, amountPaise: number, sharePercent: number): CategorySlice {
  return {
    key: name,
    categoryId: name,
    name,
    icon: null,
    color: '#000000',
    amountPaise,
    sharePercent,
    txnCount: 1,
    isOther: false,
    foldedCount: 0,
  };
}

function point(label: string, incomePaise: number, expensePaise: number): TrendPoint {
  return { monthKey: `2026-${label}`, label, incomePaise, expensePaise };
}

describe('describeCategoryChart', () => {
  it('names the total and the largest slices', () => {
    const summary = describeCategoryChart(
      [slice('Rent', 5000000, 50), slice('Food', 3000000, 30), slice('Travel', 2000000, 20)],
      10000000,
      'September 2026',
    );

    expect(summary).toContain('September 2026');
    expect(summary).toContain('₹1,00,000 across 3 categories');
    expect(summary).toContain('Rent, ₹50,000, 50%');
  });

  it('counts the rest rather than reading out twenty categories', () => {
    const slices = Array.from({ length: 6 }, (_, index) => slice(`Category ${index}`, 1000, 16.6));

    expect(describeCategoryChart(slices, 6000, 'September 2026')).toContain(
      'and 3 more categories',
    );
  });

  it('says so plainly when there is nothing to describe', () => {
    expect(describeCategoryChart([], 0, 'September 2026')).toBe(
      'Spending by category for September 2026. No spending recorded.',
    );
  });
});

describe('describeTrendChart', () => {
  it('reads every month and names the peak', () => {
    const summary = describeTrendChart(
      [point('Jul', 100000, 50000), point('Aug', 100000, 90000), point('Sep', 100000, 20000)],
      'Jul - Sep 2026',
    );

    expect(summary).toContain('Jul: in ₹1,000, out ₹500');
    expect(summary).toContain('Highest spending in Aug.');
  });

  it('is honest about an empty chart', () => {
    expect(describeTrendChart([point('Jul', 0, 0)], 'July 2026')).toContain(
      'No transactions recorded.',
    );
  });
});

describe('describeCategoryChange', () => {
  const base: CategoryChange = {
    categoryId: 'c1',
    name: 'Food',
    icon: null,
    currentPaise: 120000,
    previousPaise: 100000,
    deltaPaise: 20000,
    direction: 'up',
    changePercent: 20,
    isNew: false,
  };

  it('spells out the arrow, which is otherwise silent', () => {
    expect(describeCategoryChange(base)).toBe('Food, ₹1,200, up 20% from ₹1,000 last period.');
  });

  it('reads a fall as down, without a minus sign to mis-speak', () => {
    expect(describeCategoryChange({ ...base, direction: 'down', changePercent: -20 })).toContain(
      'down 20%',
    );
  });

  it('calls a first-time category new', () => {
    expect(describeCategoryChange({ ...base, isNew: true, changePercent: null })).toBe(
      'Food, ₹1,200, new this period.',
    );
  });

  it('does not claim a trend from small change', () => {
    expect(describeCategoryChange({ ...base, direction: 'flat' })).toContain(
      'about the same as last period',
    );
  });
});
