import type { CategoryRow } from '@/db/repositories/categories';
import {
  OTHER_SLICE_KEY,
  buildCategoryChanges,
  buildCategorySlices,
  buildTopExpenses,
  buildTrend,
  dailyAveragePaise,
} from '@/features/reports/aggregate';
import type { MonthBucket } from '@/features/reports/periods';
import { CATEGORY_SERIES_LIGHT, MAX_CATEGORY_SLICES, OTHER_SLICE_LIGHT } from '@/theme';

function category(id: string, name: string): CategoryRow {
  return {
    id,
    user_id: 'u1',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    deleted_at: null,
    name,
    type: 'expense',
    icon: 'fast-food',
    color: null,
    is_default: 1,
    parent_id: null,
  };
}

const CATEGORIES = [category('c1', 'Food'), category('c2', 'Rent'), category('c3', 'Travel')];

describe('buildCategorySlices', () => {
  it('ranks by amount and gives each slot its own colour', () => {
    const slices = buildCategorySlices(
      [
        { category_id: 'c1', spent_paise: 20000, txn_count: 2 },
        { category_id: 'c2', spent_paise: 80000, txn_count: 1 },
      ],
      CATEGORIES,
      'light',
    );

    expect(slices.map((slice) => slice.name)).toEqual(['Rent', 'Food']);
    expect(slices[0]!.color).toBe(CATEGORY_SERIES_LIGHT[0]);
    expect(slices[1]!.color).toBe(CATEGORY_SERIES_LIGHT[1]);
  });

  it('shares sum to 100 percent', () => {
    const slices = buildCategorySlices(
      [
        { category_id: 'c1', spent_paise: 25000, txn_count: 1 },
        { category_id: 'c2', spent_paise: 75000, txn_count: 1 },
      ],
      CATEGORIES,
      'light',
    );

    expect(slices.map((slice) => slice.sharePercent)).toEqual([75, 25]);
  });

  it('names a missing category rather than showing a bare id', () => {
    const [slice] = buildCategorySlices(
      [{ category_id: null, spent_paise: 5000, txn_count: 1 }],
      CATEGORIES,
      'light',
    );

    expect(slice!.name).toBe('Uncategorised');
    expect(slice!.categoryId).toBeNull();
  });

  it('folds everything past the eighth into one grey Other', () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({
      category_id: `c${index}`,
      spent_paise: (11 - index) * 1000,
      txn_count: 1,
    }));

    const slices = buildCategorySlices(rows, CATEGORIES, 'light');
    const other = slices.at(-1)!;

    expect(slices).toHaveLength(MAX_CATEGORY_SLICES);
    expect(other.key).toBe(OTHER_SLICE_KEY);
    expect(other.isOther).toBe(true);
    expect(other.foldedCount).toBe(4);
    expect(other.color).toBe(OTHER_SLICE_LIGHT);
    // 4 + 3 + 2 + 1 thousand paise.
    expect(other.amountPaise).toBe(10000);
    expect(other.txnCount).toBe(4);
  });

  it('never folds when the categories fit exactly', () => {
    const rows = Array.from({ length: MAX_CATEGORY_SLICES }, (_, index) => ({
      category_id: `c${index}`,
      spent_paise: 1000,
      txn_count: 1,
    }));

    const slices = buildCategorySlices(rows, CATEGORIES, 'light');

    expect(slices).toHaveLength(MAX_CATEGORY_SLICES);
    expect(slices.some((slice) => slice.isOther)).toBe(false);
  });

  it('is empty when nothing was spent, rather than a zero-width ring', () => {
    expect(
      buildCategorySlices(
        [{ category_id: 'c1', spent_paise: 0, txn_count: 0 }],
        CATEGORIES,
        'light',
      ),
    ).toEqual([]);
  });

  it('re-steps the colours for a dark surface', () => {
    const light = buildCategorySlices(
      [{ category_id: 'c1', spent_paise: 1000, txn_count: 1 }],
      CATEGORIES,
      'light',
    );
    const dark = buildCategorySlices(
      [{ category_id: 'c1', spent_paise: 1000, txn_count: 1 }],
      CATEGORIES,
      'dark',
    );

    expect(dark[0]!.color).not.toBe(light[0]!.color);
  });
});

describe('buildTrend', () => {
  const buckets: MonthBucket[] = [
    { key: '2026-07', label: 'Jul', from: 'a', to: 'b' },
    { key: '2026-08', label: 'Aug', from: 'b', to: 'c' },
    { key: '2026-09', label: 'Sep', from: 'c', to: 'd' },
  ];

  it('keeps the bucket order, whatever order the rows arrive in', () => {
    const points = buildTrend(
      [
        { month_key: '2026-09', income_paise: 300, expense_paise: 30 },
        { month_key: '2026-07', income_paise: 100, expense_paise: 10 },
        { month_key: '2026-08', income_paise: 200, expense_paise: 20 },
      ],
      buckets,
    );

    expect(points.map((point) => point.incomePaise)).toEqual([100, 200, 300]);
  });

  it('draws a zero for a month with no row at all', () => {
    const points = buildTrend(
      [{ month_key: '2026-08', income_paise: 5, expense_paise: 5 }],
      buckets,
    );

    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({
      monthKey: '2026-07',
      label: 'Jul',
      incomePaise: 0,
      expensePaise: 0,
    });
  });
});

describe('buildCategoryChanges', () => {
  it('reads a rise and a fall, biggest movement first', () => {
    const changes = buildCategoryChanges(
      [
        { category_id: 'c1', current_paise: 120000, previous_paise: 100000 },
        { category_id: 'c2', current_paise: 20000, previous_paise: 100000 },
      ],
      CATEGORIES,
    );

    expect(changes[0]!.name).toBe('Rent');
    expect(changes[0]!.direction).toBe('down');
    expect(changes[0]!.changePercent).toBe(-80);
    expect(changes[1]!.direction).toBe('up');
    expect(changes[1]!.changePercent).toBe(20);
  });

  it('calls a category with nothing behind it new, not infinite', () => {
    const [change] = buildCategoryChanges(
      [{ category_id: 'c1', current_paise: 50000, previous_paise: 0 }],
      CATEGORIES,
    );

    expect(change!.isNew).toBe(true);
    expect(change!.changePercent).toBeNull();
    expect(Number.isFinite(change!.deltaPaise)).toBe(true);
  });

  it('treats a change under a rupee as flat', () => {
    const [change] = buildCategoryChanges(
      [{ category_id: 'c1', current_paise: 100050, previous_paise: 100000 }],
      CATEGORIES,
    );

    expect(change!.direction).toBe('flat');
  });
});

describe('buildTopExpenses', () => {
  it('joins the category name on', () => {
    const [expense] = buildTopExpenses(
      [
        {
          id: 't1',
          amount_paise: 50000,
          note: 'Dinner',
          occurred_at: '2026-09-02T10:00:00.000Z',
          category_id: 'c1',
          account_id: 'a1',
        },
      ],
      CATEGORIES,
    );

    expect(expense!.categoryName).toBe('Food');
    expect(expense!.note).toBe('Dinner');
  });
});

describe('dailyAveragePaise', () => {
  it('divides the period total by the days it covers', () => {
    expect(dailyAveragePaise(300000, 30)).toBe(10000);
  });

  it('floors rather than inventing a fraction of a paisa', () => {
    expect(dailyAveragePaise(1000, 3)).toBe(333);
  });

  it('is zero rather than infinite with no days', () => {
    expect(dailyAveragePaise(1000, 0)).toBe(0);
  });
});
