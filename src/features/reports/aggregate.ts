/**
 * Pure transforms between the report queries and what the charts draw.
 *
 * Nothing here touches the database or the theme provider - the caller passes
 * the colour scheme in - so every rule below is unit tested directly.
 */

import type { CategoryRow } from '@/db/repositories/categories';
import { MAX_CATEGORY_SLICES, colorForSlot, otherSliceColor, type ChartScheme } from '@/theme';
import { percentageOfPaise, sumPaise } from '@/utils/money';

import type {
  CategoryChangeRow,
  CategorySpendRow,
  MonthlyTotalsRow,
  TopExpenseRow,
} from './queries';
import type { MonthBucket } from './periods';

export const UNCATEGORISED_LABEL = 'Uncategorised';
export const OTHER_LABEL = 'Other';

export interface CategorySlice {
  /** `null` for uncategorised spending, `'__other__'` for the fold. */
  key: string;
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string;
  amountPaise: number;
  /** Share of the period's total expense, to one decimal. */
  sharePercent: number;
  txnCount: number;
  /** True for the catch-all slice, which has no transaction list to open. */
  isOther: boolean;
  /** The categories folded into "Other", so its label can name the count. */
  foldedCount: number;
}

export const OTHER_SLICE_KEY = '__other__';

function nameFor(
  categoryId: string | null,
  categories: readonly CategoryRow[],
): CategoryRow | null {
  if (!categoryId) {
    return null;
  }
  return categories.find((candidate) => candidate.id === categoryId) ?? null;
}

/**
 * Ranked slices for the donut and the list beside it.
 *
 * Slot colours follow the ranked order and are never cycled: past the eighth
 * slice everything folds into a single grey "Other", because two slices
 * wearing the same colour is worse than one honest remainder.
 */
export function buildCategorySlices(
  rows: readonly CategorySpendRow[],
  categories: readonly CategoryRow[],
  scheme: ChartScheme,
): CategorySlice[] {
  const positive = rows
    .filter((row) => row.spent_paise > 0)
    .slice()
    .sort((a, b) => b.spent_paise - a.spent_paise);

  const total = sumPaise(positive.map((row) => row.spent_paise));
  if (total === 0) {
    return [];
  }

  const fits = positive.length <= MAX_CATEGORY_SLICES;
  const headCount = fits ? positive.length : MAX_CATEGORY_SLICES - 1;
  const head = positive.slice(0, headCount);
  const tail = positive.slice(headCount);

  const slices: CategorySlice[] = head.map((row, index) => {
    const category = nameFor(row.category_id, categories);
    return {
      key: row.category_id ?? 'uncategorised',
      categoryId: row.category_id,
      name: category?.name ?? UNCATEGORISED_LABEL,
      icon: category?.icon ?? null,
      color: colorForSlot(index, scheme),
      amountPaise: row.spent_paise,
      sharePercent: percentageOfPaise(row.spent_paise, total),
      txnCount: row.txn_count,
      isOther: false,
      foldedCount: 0,
    };
  });

  if (tail.length > 0) {
    const amount = sumPaise(tail.map((row) => row.spent_paise));
    slices.push({
      key: OTHER_SLICE_KEY,
      categoryId: null,
      name: OTHER_LABEL,
      icon: null,
      color: otherSliceColor(scheme),
      amountPaise: amount,
      sharePercent: percentageOfPaise(amount, total),
      txnCount: tail.reduce((count, row) => count + row.txn_count, 0),
      isOther: true,
      foldedCount: tail.length,
    });
  }

  return slices;
}

export interface TrendPoint {
  monthKey: string;
  label: string;
  incomePaise: number;
  expensePaise: number;
}

/**
 * One point per month in the period, oldest first. A month with no rows still
 * appears, at zero, so the axis keeps its spacing and a gap reads as a gap.
 */
export function buildTrend(
  rows: readonly MonthlyTotalsRow[],
  buckets: readonly MonthBucket[],
): TrendPoint[] {
  return buckets.map((bucket) => {
    const row = rows.find((candidate) => candidate.month_key === bucket.key);
    return {
      monthKey: bucket.key,
      label: bucket.label,
      incomePaise: row?.income_paise ?? 0,
      expensePaise: row?.expense_paise ?? 0,
    };
  });
}

export type ChangeDirection = 'up' | 'down' | 'flat';

export interface CategoryChange {
  categoryId: string | null;
  name: string;
  icon: string | null;
  currentPaise: number;
  previousPaise: number;
  deltaPaise: number;
  direction: ChangeDirection;
  /**
   * Percentage change, or `null` when there is nothing to compare against -
   * spending 500 where you previously spent 0 is "new", not "+Infinity%".
   */
  changePercent: number | null;
  isNew: boolean;
}

/** Under this, a change is noise rather than a trend: 1 rupee. */
const FLAT_THRESHOLD_PAISE = 100;

export function buildCategoryChanges(
  rows: readonly CategoryChangeRow[],
  categories: readonly CategoryRow[],
): CategoryChange[] {
  return rows
    .map((row) => {
      const category = nameFor(row.category_id, categories);
      const delta = row.current_paise - row.previous_paise;
      const direction: ChangeDirection =
        Math.abs(delta) < FLAT_THRESHOLD_PAISE ? 'flat' : delta > 0 ? 'up' : 'down';

      return {
        categoryId: row.category_id,
        name: category?.name ?? UNCATEGORISED_LABEL,
        icon: category?.icon ?? null,
        currentPaise: row.current_paise,
        previousPaise: row.previous_paise,
        deltaPaise: delta,
        direction,
        changePercent:
          row.previous_paise > 0 ? percentageOfPaise(delta, row.previous_paise, 0) : null,
        isNew: row.previous_paise === 0 && row.current_paise > 0,
      };
    })
    .sort((a, b) => Math.abs(b.deltaPaise) - Math.abs(a.deltaPaise));
}

export interface TopExpense {
  id: string;
  amountPaise: number;
  note: string | null;
  occurredAt: string;
  categoryId: string | null;
  categoryName: string;
  icon: string | null;
}

export function buildTopExpenses(
  rows: readonly TopExpenseRow[],
  categories: readonly CategoryRow[],
): TopExpense[] {
  return rows.map((row) => {
    const category = nameFor(row.category_id, categories);
    return {
      id: row.id,
      amountPaise: row.amount_paise,
      note: row.note,
      occurredAt: row.occurred_at,
      categoryId: row.category_id,
      categoryName: category?.name ?? UNCATEGORISED_LABEL,
      icon: category?.icon ?? null,
    };
  });
}

/**
 * Average spend per day over the days the period has actually seen. Integer
 * paise, floored - an average is for reading, and a fractional paisa is not a
 * thing you can spend.
 */
export function dailyAveragePaise(totalExpensePaise: number, days: number): number {
  if (days <= 0) {
    return 0;
  }
  return Math.floor(totalExpensePaise / days);
}
