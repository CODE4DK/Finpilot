import {
  OVER_THRESHOLD,
  WARNING_THRESHOLD,
  usedFraction,
  usedPercentage,
  type BudgetLike,
} from './budget-math';

/**
 * Deciding when to tell someone they are near, or past, a budget.
 *
 * The rule that matters: **at most one notification per budget per threshold
 * per month**. A budget hovering at 80% must not buzz on every coffee. The
 * `alert_80_sent` and `alert_100_sent` flags on the row are what enforce that,
 * and because they are synced columns the second device stays quiet too.
 *
 * All pure: this decides, `use-budget-alerts.ts` delivers.
 */

export type AlertThreshold = 80 | 100;

export interface BudgetAlert {
  budgetId: string;
  categoryId: string;
  threshold: AlertThreshold;
  spentPaise: number;
  limitPaise: number;
  usedPercentage: number;
}

/** Which thresholds this budget has crossed but not yet announced. */
export function pendingAlertsFor(budget: BudgetLike): AlertThreshold[] {
  if (budget.limit_paise <= 0) {
    return [];
  }

  const used = usedFraction(budget.spent_paise, budget.limit_paise);
  const thresholds: AlertThreshold[] = [];

  // 100 is checked first so a budget that jumps straight past both only
  // announces the one that matters.
  if (used >= OVER_THRESHOLD && !budget.alert_100_sent) {
    thresholds.push(100);
    return thresholds;
  }

  if (used >= WARNING_THRESHOLD && used < OVER_THRESHOLD && !budget.alert_80_sent) {
    thresholds.push(80);
  }

  return thresholds;
}

/** Every alert owed across a month's budgets. */
export function collectAlerts(budgets: readonly BudgetLike[]): BudgetAlert[] {
  return budgets.flatMap((budget) =>
    pendingAlertsFor(budget).map<BudgetAlert>((threshold) => ({
      budgetId: budget.id,
      categoryId: budget.category_id,
      threshold,
      spentPaise: budget.spent_paise,
      limitPaise: budget.limit_paise,
      usedPercentage: usedPercentage(budget.spent_paise, budget.limit_paise),
    })),
  );
}

/**
 * The flags to write once an alert has been delivered. Crossing 100 marks 80
 * as well: having been told you are over, being told you are near is noise.
 */
export function flagsForDeliveredAlert(threshold: AlertThreshold): {
  alert_80_sent: number;
  alert_100_sent?: number;
} {
  return threshold === 100 ? { alert_80_sent: 1, alert_100_sent: 1 } : { alert_80_sent: 1 };
}

export interface AlertCopy {
  title: string;
  body: string;
}

/**
 * What the notification says. Plain, specific, and never alarming about
 * someone's own money - it states the fact and leaves the judgement to them.
 */
export function alertCopy(
  alert: BudgetAlert,
  categoryName: string,
  formatAmount: (paise: number) => string,
): AlertCopy {
  if (alert.threshold === 100) {
    return {
      title: `${categoryName} budget used up`,
      body: `You've spent ${formatAmount(alert.spentPaise)} of your ${formatAmount(
        alert.limitPaise,
      )} ${categoryName} budget this month.`,
    };
  }

  return {
    title: `${categoryName} budget at ${alert.usedPercentage}%`,
    body: `${formatAmount(alert.limitPaise - alert.spentPaise)} left of your ${formatAmount(
      alert.limitPaise,
    )} ${categoryName} budget this month.`,
  };
}

/**
 * Resetting for a new month. Budgets are per-month rows, so a fresh month
 * starts with clear flags by construction - this is only for the case where a
 * limit is raised and the user should be able to be warned again.
 */
export function shouldResetFlags(previousLimitPaise: number, nextLimitPaise: number): boolean {
  return nextLimitPaise > previousLimitPaise;
}
