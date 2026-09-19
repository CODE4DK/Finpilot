import { addPaise, clampPaise, subtractPaise } from '@/utils/money';

/**
 * Budget arithmetic.
 *
 * Everything here is pure and works in integer paise. The screens only render
 * what these functions decide, so "am I over budget?" has exactly one answer
 * in the codebase.
 */

/** Where a budget turns amber, and where it turns red. */
export const WARNING_THRESHOLD = 0.8;
export const OVER_THRESHOLD = 1;

export type BudgetTone = 'primary' | 'warning' | 'expense';

export interface BudgetLike {
  id: string;
  category_id: string;
  limit_paise: number;
  spent_paise: number;
  alert_80_sent?: number;
  alert_100_sent?: number;
}

/**
 * Spent over limit, as a fraction. A zero limit would divide by zero, so it
 * reports 0 - a budget of nothing cannot be exceeded.
 */
export function usedFraction(spentPaise: number, limitPaise: number): number {
  if (limitPaise <= 0) {
    return 0;
  }
  return spentPaise / limitPaise;
}

/** Rounded percentage for display. Not clamped: 140% is worth seeing. */
export function usedPercentage(spentPaise: number, limitPaise: number): number {
  return Math.round(usedFraction(spentPaise, limitPaise) * 100);
}

/**
 * Green below 80%, amber from 80% to just under 100%, red at 100% and above.
 * Colour is never the only signal on screen - the percentage is always there
 * too - but this is the one place the bands are defined.
 */
export function toneFor(spentPaise: number, limitPaise: number): BudgetTone {
  const used = usedFraction(spentPaise, limitPaise);
  if (used >= OVER_THRESHOLD) {
    return 'expense';
  }
  if (used >= WARNING_THRESHOLD) {
    return 'warning';
  }
  return 'primary';
}

/** What is left. Never negative - "how much over" is a separate question. */
export function remainingPaise(spentPaise: number, limitPaise: number): number {
  return Math.max(subtractPaise(limitPaise, spentPaise), 0);
}

/** How far past the limit, or 0 when still inside it. */
export function overspentPaise(spentPaise: number, limitPaise: number): number {
  return Math.max(subtractPaise(spentPaise, limitPaise), 0);
}

/**
 * Days left in the month, counting today. On the last day this is 1, never 0,
 * because "safe to spend per day" divides by it and the day is not over.
 */
export function daysLeftInMonth(now: Date = new Date()): number {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate() + 1;
}

export function daysElapsedInMonth(now: Date = new Date()): number {
  return now.getDate();
}

/**
 * What can still be spent each remaining day without breaking the budget.
 * Zero once the budget is spent - there is no negative daily allowance.
 */
export function safeToSpendPerDay(
  spentPaise: number,
  limitPaise: number,
  now: Date = new Date(),
): number {
  const remaining = remainingPaise(spentPaise, limitPaise);
  const days = daysLeftInMonth(now);
  return Math.floor(remaining / days);
}

/**
 * Spending pace. 1 means exactly on track for the day of the month; above 1
 * means the budget will run out early at this rate.
 */
export function paceRatio(spentPaise: number, limitPaise: number, now: Date = new Date()): number {
  if (limitPaise <= 0) {
    return 0;
  }
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedFraction = daysElapsedInMonth(now) / daysInMonth;
  if (expectedFraction === 0) {
    return 0;
  }
  return usedFraction(spentPaise, limitPaise) / expectedFraction;
}

/** "3 days left · ₹450 a day" - the line under a budget bar. */
export function describePace(
  spentPaise: number,
  limitPaise: number,
  now: Date = new Date(),
): string {
  const over = overspentPaise(spentPaise, limitPaise);
  if (over > 0) {
    return 'Over budget';
  }

  const days = daysLeftInMonth(now);
  const perDay = safeToSpendPerDay(spentPaise, limitPaise, now);
  const dayWord = days === 1 ? 'day' : 'days';

  if (perDay === 0) {
    return `${days} ${dayWord} left · nothing left to spend`;
  }
  return `${days} ${dayWord} left`;
}

export interface BudgetSummary {
  limitPaise: number;
  spentPaise: number;
  remainingPaise: number;
  overspentPaise: number;
  usedFraction: number;
  usedPercentage: number;
  tone: BudgetTone;
  daysLeft: number;
  safeToSpendPerDayPaise: number;
  /** How many budgets are at or past their limit. */
  overCount: number;
  /** How many are in the amber band. */
  warningCount: number;
}

/** The whole month across every budget - the card at the top of the tab. */
export function summariseBudgets(
  budgets: readonly BudgetLike[],
  now: Date = new Date(),
): BudgetSummary {
  const limitPaise = budgets.reduce((total, budget) => addPaise(total, budget.limit_paise), 0);
  const spentPaise = budgets.reduce((total, budget) => addPaise(total, budget.spent_paise), 0);

  return {
    limitPaise,
    spentPaise,
    remainingPaise: remainingPaise(spentPaise, limitPaise),
    overspentPaise: overspentPaise(spentPaise, limitPaise),
    usedFraction: usedFraction(spentPaise, limitPaise),
    usedPercentage: usedPercentage(spentPaise, limitPaise),
    tone: toneFor(spentPaise, limitPaise),
    daysLeft: daysLeftInMonth(now),
    safeToSpendPerDayPaise: safeToSpendPerDay(spentPaise, limitPaise, now),
    overCount: budgets.filter(
      (budget) => toneFor(budget.spent_paise, budget.limit_paise) === 'expense',
    ).length,
    warningCount: budgets.filter(
      (budget) => toneFor(budget.spent_paise, budget.limit_paise) === 'warning',
    ).length,
  };
}

/** Keeps a limit inside what the database will accept. */
export function normaliseLimit(paise: number | null): number | null {
  if (paise === null) {
    return null;
  }
  // The CHECK constraint requires a positive limit.
  return paise > 0 ? clampPaise(paise, 1, Number.MAX_SAFE_INTEGER) : null;
}
