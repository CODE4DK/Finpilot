/**
 * Chart colours.
 *
 * These are **not** the semantic tokens. A chart asks a different question of
 * colour than a balance figure does: eight category slices have to stay
 * distinguishable from each other, including for the ~8% of men with red-green
 * colour vision deficiency.
 *
 * Every palette here was checked with a CVD validator against FinPilot's actual
 * surfaces (#FFFFFF light, #1B2638 dark - charts live inside cards):
 *
 *   * Categorical, adjacent pairs: worst CVD ΔE 9.1 light / 8.4 dark (≥8 target),
 *     worst normal-vision ΔE 19.6 light / 19.3 dark (≥15 floor).
 *   * Three light slots fall below 3:1 against white. That is allowed only
 *     because every chart here ships a ranked list beside it carrying the same
 *     numbers - identity never rests on the colour alone.
 *
 * The dark column is the same eight hues re-stepped for a dark surface, not an
 * automatic inversion.
 */

export const CATEGORY_SERIES_LIGHT = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
] as const;

export const CATEGORY_SERIES_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const;

/**
 * Income vs expense on the trend chart.
 *
 * Deliberately **not** the green/red of the income and expense tokens. That
 * pair scores ΔE 4.2 under deuteranopia - far below the 8 floor - so a
 * red-green viewer sees two identical bars. Blue and orange score 24.7 and
 * read as clearly for everyone. The green and red stay where they belong: on
 * amounts, where a +/- sign carries the meaning too.
 */
export const TREND_SERIES_LIGHT = { income: '#2a78d6', expense: '#eb6834' } as const;
export const TREND_SERIES_DARK = { income: '#3987e5', expense: '#d95926' } as const;

export type ChartScheme = 'light' | 'dark';

export function categorySeries(scheme: ChartScheme): readonly string[] {
  return scheme === 'dark' ? CATEGORY_SERIES_DARK : CATEGORY_SERIES_LIGHT;
}

export function trendSeries(scheme: ChartScheme): { income: string; expense: string } {
  return scheme === 'dark' ? TREND_SERIES_DARK : TREND_SERIES_LIGHT;
}

/**
 * The slot for a series, by its position in the ranked order.
 *
 * Colour follows the entity's rank in a *stable* ordering, and slots are never
 * cycled: a ninth category folds into "Other" rather than reusing slot 1,
 * because two slices of the same colour is worse than one honest catch-all.
 */
export const MAX_CATEGORY_SLICES = 8;

export function colorForSlot(index: number, scheme: ChartScheme): string {
  const series = categorySeries(scheme);
  return series[Math.min(index, series.length - 1)]!;
}

/** The muted grey an "Other" slice wears - it is a remainder, not a category. */
export const OTHER_SLICE_LIGHT = '#94A3B8';
export const OTHER_SLICE_DARK = '#64748B';

export function otherSliceColor(scheme: ChartScheme): string {
  return scheme === 'dark' ? OTHER_SLICE_DARK : OTHER_SLICE_LIGHT;
}
