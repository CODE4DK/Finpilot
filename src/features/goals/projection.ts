import { addPaise, subtractPaise } from '@/utils/money';

/**
 * Goal progress and projections.
 *
 * Two questions a goal has to answer honestly:
 *   * "What must I put aside each month to make the date?" - arithmetic.
 *   * "When will I actually get there?" - a projection from the rate so far,
 *     which is a guess and is labelled as one on screen.
 *
 * Both return null rather than a fabricated number when there is nothing to
 * base them on. A goal with no contributions has no rate, and pretending
 * otherwise would be worse than saying so.
 */

export interface GoalLike {
  id: string;
  target_paise: number;
  target_date?: string | null;
  status: string;
  created_at: string;
}

export interface ContributionLike {
  amount_paise: number;
  contributed_at: string;
  deleted_at?: string | null;
}

export function savedPaise(contributions: readonly ContributionLike[]): number {
  return contributions.reduce(
    (total, contribution) =>
      contribution.deleted_at ? total : addPaise(total, contribution.amount_paise),
    0,
  );
}

export function remainingPaise(targetPaise: number, saved: number): number {
  return Math.max(subtractPaise(targetPaise, saved), 0);
}

/** 0 to 1, clamped - a goal can be over-funded but the ring stops at full. */
export function progressFraction(targetPaise: number, saved: number): number {
  if (targetPaise <= 0) {
    return 0;
  }
  return Math.min(saved / targetPaise, 1);
}

export function progressPercentage(targetPaise: number, saved: number): number {
  return Math.round(progressFraction(targetPaise, saved) * 100);
}

export function isComplete(targetPaise: number, saved: number): boolean {
  return targetPaise > 0 && saved >= targetPaise;
}

/**
 * Whole months between two dates, rounded up and never below 1: a target date
 * inside this month still needs this month's contribution.
 */
export function monthsUntil(target: Date, now: Date = new Date()): number {
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  // A target later in the same month still counts as one month to go.
  const adjusted = target.getDate() >= now.getDate() ? months : months - 1;
  return Math.max(adjusted + 1, 1);
}

/**
 * What must be set aside monthly to hit the target date. Null when the goal
 * has no date - there is nothing to divide by - and 0 once it is funded.
 */
export function requiredMonthlyPaise(
  goal: GoalLike,
  saved: number,
  now: Date = new Date(),
): number | null {
  if (!goal.target_date) {
    return null;
  }

  const remaining = remainingPaise(goal.target_paise, saved);
  if (remaining === 0) {
    return 0;
  }

  const target = new Date(goal.target_date);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  // A date already past cannot be met by saving monthly; the whole remainder
  // is owed now.
  if (target.getTime() <= now.getTime()) {
    return remaining;
  }

  return Math.ceil(remaining / monthsUntil(target, now));
}

/**
 * The average contribution per month so far, measured from the first
 * contribution (not the goal's creation, which may long predate any saving).
 * Null when there is nothing to average.
 */
export function averageMonthlyPaise(
  contributions: readonly ContributionLike[],
  now: Date = new Date(),
): number | null {
  const live = contributions.filter((contribution) => !contribution.deleted_at);
  if (live.length === 0) {
    return null;
  }

  const timestamps = live.map((contribution) => new Date(contribution.contributed_at).getTime());
  const earliest = new Date(Math.min(...timestamps));

  const elapsedMonths = Math.max(
    (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1,
    1,
  );

  return Math.floor(savedPaise(live) / elapsedMonths);
}

export interface Projection {
  /** When the goal is expected to complete at the current rate. */
  date: Date;
  monthsRemaining: number;
  /** True when the projection lands after the target date. */
  behindTarget: boolean;
}

/**
 * Projected completion from the rate so far. Null when there is no rate to
 * project from, or when the rate is zero - an honest "we cannot say" rather
 * than a date infinitely far away.
 */
export function projectCompletion(
  goal: GoalLike,
  contributions: readonly ContributionLike[],
  now: Date = new Date(),
): Projection | null {
  const saved = savedPaise(contributions);
  const remaining = remainingPaise(goal.target_paise, saved);

  if (remaining === 0) {
    return { date: now, monthsRemaining: 0, behindTarget: false };
  }

  const rate = averageMonthlyPaise(contributions, now);
  if (rate === null || rate <= 0) {
    return null;
  }

  const monthsRemaining = Math.ceil(remaining / rate);
  const date = new Date(now.getFullYear(), now.getMonth() + monthsRemaining, now.getDate());

  const target = goal.target_date ? new Date(goal.target_date) : null;
  const behindTarget = Boolean(
    target && !Number.isNaN(target.getTime()) && date.getTime() > target.getTime(),
  );

  return { date, monthsRemaining, behindTarget };
}

export interface GoalSummary {
  savedPaise: number;
  remainingPaise: number;
  progressFraction: number;
  progressPercentage: number;
  isComplete: boolean;
  requiredMonthlyPaise: number | null;
  averageMonthlyPaise: number | null;
  projection: Projection | null;
}

export function summariseGoal(
  goal: GoalLike,
  contributions: readonly ContributionLike[],
  now: Date = new Date(),
): GoalSummary {
  const saved = savedPaise(contributions);

  return {
    savedPaise: saved,
    remainingPaise: remainingPaise(goal.target_paise, saved),
    progressFraction: progressFraction(goal.target_paise, saved),
    progressPercentage: progressPercentage(goal.target_paise, saved),
    isComplete: isComplete(goal.target_paise, saved),
    requiredMonthlyPaise: requiredMonthlyPaise(goal, saved, now),
    averageMonthlyPaise: averageMonthlyPaise(contributions, now),
    projection: projectCompletion(goal, contributions, now),
  };
}

/** "March 2027" - how a projected date is shown. */
export function formatProjectionDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
