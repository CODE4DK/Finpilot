/**
 * Spoken summaries of the charts.
 *
 * A donut is a picture of a ratio; a screen reader gets nothing from a Skia
 * canvas. Each chart is wrapped in one `accessible` view carrying the string
 * built here, so the chart is announced as a sentence a person can act on -
 * the shape of the data, not "image".
 *
 * These are read aloud, so they name amounts in words the formatter already
 * produces and round hard: "₹12,400" not "₹12,399.50 which is 31.4%".
 */

import { formatINR } from '@/utils/money';

import type { CategoryChange, CategorySlice, TrendPoint } from './aggregate';

const money = (paise: number) => formatINR(paise, { withDecimals: false });

/** How many slices the summary names before it stops listing. */
const SPOKEN_SLICES = 3;

export function describeCategoryChart(
  slices: readonly CategorySlice[],
  totalExpensePaise: number,
  periodLabel: string,
): string {
  if (slices.length === 0) {
    return `Spending by category for ${periodLabel}. No spending recorded.`;
  }

  const named = slices
    .slice(0, SPOKEN_SLICES)
    .map(
      (slice) => `${slice.name}, ${money(slice.amountPaise)}, ${Math.round(slice.sharePercent)}%`,
    )
    .join('; ');

  const rest = slices.length - SPOKEN_SLICES;
  const tail = rest > 0 ? ` and ${rest} more ${rest === 1 ? 'category' : 'categories'}` : '';

  return `Spending by category for ${periodLabel}. ${money(totalExpensePaise)} across ${slices.length} ${
    slices.length === 1 ? 'category' : 'categories'
  }. Largest: ${named}${tail}.`;
}

export function describeTrendChart(points: readonly TrendPoint[], periodLabel: string): string {
  const withActivity = points.filter((point) => point.incomePaise > 0 || point.expensePaise > 0);

  if (withActivity.length === 0) {
    return `Income against expense for ${periodLabel}. No transactions recorded.`;
  }

  const highest = withActivity.reduce((best, point) =>
    point.expensePaise > best.expensePaise ? point : best,
  );

  const months = points
    .map(
      (point) => `${point.label}: in ${money(point.incomePaise)}, out ${money(point.expensePaise)}`,
    )
    .join('. ');

  return `Income against expense by month for ${periodLabel}. ${months}. Highest spending in ${highest.label}.`;
}

/** The up/down list, which is otherwise announced as bare arrows. */
export function describeCategoryChange(change: CategoryChange): string {
  if (change.isNew) {
    return `${change.name}, ${money(change.currentPaise)}, new this period.`;
  }
  if (change.direction === 'flat') {
    return `${change.name}, ${money(change.currentPaise)}, about the same as last period.`;
  }
  const word = change.direction === 'up' ? 'up' : 'down';
  const percent = change.changePercent === null ? '' : ` ${Math.abs(change.changePercent)}%`;
  return `${change.name}, ${money(change.currentPaise)}, ${word}${percent} from ${money(
    change.previousPaise,
  )} last period.`;
}
