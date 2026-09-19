/**
 * Insights computed on the device.
 *
 * This is what a user sees when they have not opted in to the AI feature, when
 * they are offline, and whenever the Edge Function cannot answer. It is not a
 * degraded placeholder: most of what is worth saying about a month is
 * arithmetic, and arithmetic works on a train with no signal.
 *
 * Every rule here is deliberately conservative - it states what the numbers
 * say and stops. Nothing is projected from one data point, and a month with
 * nothing in it produces a short honest insight rather than a padded one.
 */

import { formatINR, percentageOfPaise } from '@/utils/money';

import type { Insight, InsightHighlight, InsightSuggestion, InsightUnusualSpend } from './types';

export interface RuleCategory {
  name: string;
  spentPaise: number;
  previousPaise: number;
  txnCount: number;
}

export interface RuleBudget {
  category: string;
  limitPaise: number;
  spentPaise: number;
}

export interface RuleGoal {
  name: string;
  targetPaise: number;
  savedPaise: number;
  targetDate: string | null;
}

export interface RuleInput {
  monthLabel: string;
  incomePaise: number;
  expensePaise: number;
  previousExpensePaise: number;
  daysElapsed: number;
  daysInMonth: number;
  categories: RuleCategory[];
  budgets: RuleBudget[];
  goals: RuleGoal[];
  now?: Date;
}

/** Below this, a change is noise rather than a trend: 500 rupees. */
const MATERIAL_CHANGE_PAISE = 50000;
/** And it has to be a real proportion of the category, not just a big number. */
const MATERIAL_CHANGE_PERCENT = 25;

const money = (paise: number) => formatINR(paise, { withDecimals: false });

function severityFor(changePercent: number): InsightUnusualSpend['severity'] {
  if (changePercent >= 100) {
    return 'high';
  }
  if (changePercent >= 50) {
    return 'medium';
  }
  return 'low';
}

function buildSummary(input: RuleInput): string {
  const { expensePaise, incomePaise, previousExpensePaise, monthLabel } = input;

  if (expensePaise === 0 && incomePaise === 0) {
    return `Nothing recorded for ${monthLabel} yet. Add a few transactions and this fills in.`;
  }

  const net = incomePaise - expensePaise;
  const parts = [
    `In ${monthLabel} you have spent ${money(expensePaise)} and taken in ${money(incomePaise)}.`,
  ];

  parts.push(
    net >= 0
      ? `That leaves you ${money(net)} ahead so far.`
      : `That is ${money(Math.abs(net))} more out than in so far.`,
  );

  if (previousExpensePaise > 0) {
    const change = percentageOfPaise(expensePaise - previousExpensePaise, previousExpensePaise, 0);
    if (Math.abs(change) < 5) {
      parts.push('Spending is about level with last month.');
    } else {
      parts.push(
        change > 0
          ? `Spending is ${Math.abs(change)}% higher than last month.`
          : `Spending is ${Math.abs(change)}% lower than last month.`,
      );
    }
  }

  return parts.join(' ');
}

function buildHighlights(input: RuleInput): InsightHighlight[] {
  const highlights: InsightHighlight[] = [];
  const { expensePaise, daysElapsed, daysInMonth } = input;

  const biggest = [...input.categories].sort((a, b) => b.spentPaise - a.spentPaise)[0];
  if (biggest && biggest.spentPaise > 0) {
    highlights.push({
      title: `${biggest.name} is your largest category`,
      detail: `${money(biggest.spentPaise)} across ${biggest.txnCount} ${
        biggest.txnCount === 1 ? 'transaction' : 'transactions'
      }, ${percentageOfPaise(biggest.spentPaise, expensePaise, 0)}% of what you spent.`,
    });
  }

  if (expensePaise > 0 && daysElapsed > 0) {
    const perDay = Math.floor(expensePaise / daysElapsed);
    // Only worth projecting while the month is genuinely in progress; on the
    // last day the "projection" is just the total again.
    const projecting = daysElapsed < daysInMonth;
    highlights.push({
      title: `${money(perDay)} a day so far`,
      detail: projecting
        ? `At this pace the month finishes around ${money(perDay * daysInMonth)}.`
        : `Over the whole of ${input.monthLabel}.`,
    });
  }

  const uncategorised = input.categories.find((category) => category.name === 'Uncategorised');
  if (uncategorised && percentageOfPaise(uncategorised.spentPaise, expensePaise, 0) >= 20) {
    highlights.push({
      title: 'A fifth of your spending has no category',
      detail: `${money(uncategorised.spentPaise)} is uncategorised, so these figures are rougher than they could be.`,
    });
  }

  return highlights.slice(0, 3);
}

function buildUnusualSpend(input: RuleInput): InsightUnusualSpend[] {
  const unusual: InsightUnusualSpend[] = [];

  for (const category of input.categories) {
    const delta = category.spentPaise - category.previousPaise;
    if (delta < MATERIAL_CHANGE_PAISE) {
      continue;
    }

    if (category.previousPaise === 0) {
      unusual.push({
        category: category.name,
        detail: `${money(category.spentPaise)} this month, and nothing last month.`,
        severity: severityFor(100),
      });
      continue;
    }

    const changePercent = percentageOfPaise(delta, category.previousPaise, 0);
    if (changePercent < MATERIAL_CHANGE_PERCENT) {
      continue;
    }

    unusual.push({
      category: category.name,
      detail: `${money(category.spentPaise)}, up ${changePercent}% from ${money(
        category.previousPaise,
      )} last month.`,
      severity: severityFor(changePercent),
    });
  }

  return unusual.sort((a, b) => rank(b.severity) - rank(a.severity)).slice(0, 3);
}

function rank(severity: InsightUnusualSpend['severity']): number {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
}

function buildSuggestions(input: RuleInput): InsightSuggestion[] {
  const suggestions: InsightSuggestion[] = [];
  const { daysElapsed, daysInMonth } = input;

  const over = input.budgets.filter((budget) => budget.spentPaise >= budget.limitPaise);
  if (over.length > 0) {
    const first = over[0]!;
    suggestions.push({
      title:
        over.length === 1 ? `${first.category} is over budget` : `${over.length} budgets are over`,
      detail:
        over.length === 1
          ? `${money(first.spentPaise)} against a ${money(first.limitPaise)} limit.`
          : `Together they are ${money(
              over.reduce((total, budget) => total + budget.spentPaise - budget.limitPaise, 0),
            )} past their limits.`,
    });
  }

  // A budget that is on track to be blown but has not been yet is the one
  // worth mentioning - there is still a month left to do something about it.
  if (daysElapsed > 0 && daysElapsed < daysInMonth) {
    const pacing = input.budgets.find((budget) => {
      if (budget.spentPaise >= budget.limitPaise || budget.limitPaise === 0) {
        return false;
      }
      const projected = (budget.spentPaise / daysElapsed) * daysInMonth;
      return projected > budget.limitPaise;
    });

    if (pacing) {
      const remaining = pacing.limitPaise - pacing.spentPaise;
      const daysLeft = daysInMonth - daysElapsed;
      suggestions.push({
        title: `${pacing.category} is pacing over budget`,
        detail: `${money(remaining)} left for ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} - about ${money(
          Math.floor(remaining / daysLeft),
        )} a day.`,
      });
    }
  }

  const unfunded = input.goals.find((goal) => goal.savedPaise < goal.targetPaise);
  if (unfunded) {
    const remaining = unfunded.targetPaise - unfunded.savedPaise;
    suggestions.push({
      title: `${unfunded.name} needs ${money(remaining)} more`,
      detail: `${percentageOfPaise(unfunded.savedPaise, unfunded.targetPaise, 0)}% of the way there.`,
    });
  }

  if (input.budgets.length === 0 && input.expensePaise > 0) {
    const biggest = [...input.categories].sort((a, b) => b.spentPaise - a.spentPaise)[0];
    suggestions.push({
      title: 'Try a budget for your biggest category',
      detail: biggest
        ? `You spent ${money(biggest.spentPaise)} on ${biggest.name} this month - a limit makes that visible as it happens.`
        : 'A limit makes spending visible as it happens, rather than at the end of the month.',
    });
  }

  return suggestions.slice(0, 3);
}

/**
 * The whole rule set. Pure: same input, same insight, no clock unless one is
 * passed in.
 */
export function buildRuleBasedInsight(input: RuleInput): Insight {
  return {
    summary: buildSummary(input),
    highlights: buildHighlights(input),
    unusual_spend: buildUnusualSpend(input),
    suggestions: buildSuggestions(input),
    source: 'rules',
    generated_at: (input.now ?? new Date()).toISOString(),
  };
}
