import { v5 as uuidv5 } from 'uuid';

import type { RecurrenceFrequency, TransactionType } from '@/db/enums';

import { anchorDayOf, occurrencesUpTo, type OccurrenceResult } from './schedule';

/**
 * Generating the transactions a recurring rule owes.
 *
 * The hard requirement is idempotency across devices: a phone and a tablet,
 * both offline, must not each create "September's rent". They cannot talk to
 * each other, so the id cannot be random - it is derived from the rule and the
 * occurrence instant with UUID v5, which is a plain SHA-1 over a namespace and
 * a name. Same rule, same occurrence, same id on every device, forever. The
 * upload then converges to one row because a PUT is an upsert.
 */

/**
 * A fixed namespace for FinPilot's generated transactions. The value itself is
 * arbitrary, but it must never change: a new namespace would make every device
 * disagree with every row generated before the change, and the duplicates
 * could not be reconciled.
 */
export const RECURRING_NAMESPACE = '9f4b8a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b';

/** The name hashed into the v5 id. Stable and canonical, so devices agree. */
export function occurrenceName(ruleId: string, occurredAt: Date): string {
  return `${ruleId}:${occurredAt.toISOString()}`;
}

/** The deterministic id for one occurrence of one rule. */
export function occurrenceId(ruleId: string, occurredAt: Date): string {
  return uuidv5(occurrenceName(ruleId, occurredAt), RECURRING_NAMESPACE);
}

export interface RecurringRuleLike {
  id: string;
  type: TransactionType;
  amount_paise: number;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  note?: string | null;
  frequency: RecurrenceFrequency;
  interval: number;
  next_run_at: string;
  end_at?: string | null;
  is_active: number;
  deleted_at?: string | null;
}

export interface GeneratedTransaction {
  id: string;
  type: TransactionType;
  amount_paise: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note: string | null;
  occurred_at: string;
  recurring_rule_id: string;
}

export interface RulePlan {
  ruleId: string;
  transactions: GeneratedTransaction[];
  /** ISO-8601, or null once the rule has run its course. */
  nextRunAt: string | null;
  /** Whether the rule should stay active. */
  stillActive: boolean;
  truncated: boolean;
}

/** Is this rule eligible to run at all? */
export function isRunnable(rule: RecurringRuleLike): boolean {
  return !rule.deleted_at && rule.is_active === 1;
}

/**
 * What a single rule owes as of `now`. Pure - it decides, it does not write.
 */
export function planForRule(rule: RecurringRuleLike, now: Date): RulePlan {
  if (!isRunnable(rule)) {
    return {
      ruleId: rule.id,
      transactions: [],
      nextRunAt: rule.next_run_at,
      stillActive: rule.is_active === 1,
      truncated: false,
    };
  }

  const from = new Date(rule.next_run_at);
  const endAt = rule.end_at ? new Date(rule.end_at) : null;

  const result: OccurrenceResult = occurrencesUpTo({
    from,
    until: now,
    endAt,
    frequency: rule.frequency,
    interval: rule.interval,
    anchorDay: anchorDayOf(from),
  });

  const transactions = result.occurrences.map<GeneratedTransaction>((occurredAt) => ({
    id: occurrenceId(rule.id, occurredAt),
    type: rule.type,
    amount_paise: rule.amount_paise,
    account_id: rule.account_id,
    to_account_id: rule.to_account_id ?? null,
    category_id: rule.category_id ?? null,
    note: rule.note ?? null,
    occurred_at: occurredAt.toISOString(),
    recurring_rule_id: rule.id,
  }));

  return {
    ruleId: rule.id,
    transactions,
    nextRunAt: result.nextRunAt ? result.nextRunAt.toISOString() : null,
    // A rule with nowhere left to run is retired rather than checked forever.
    stillActive: result.nextRunAt !== null,
    truncated: result.truncated,
  };
}

export interface GenerationPlan {
  rules: RulePlan[];
  transactions: GeneratedTransaction[];
  /** Whether anything at all needs writing. */
  hasWork: boolean;
}

/** What every rule owes, as one plan the caller can apply in a transaction. */
export function planGeneration(
  rules: readonly RecurringRuleLike[],
  now: Date = new Date(),
): GenerationPlan {
  const plans = rules.map((rule) => planForRule(rule, now));
  const transactions = plans.flatMap((plan) => plan.transactions);

  const hasWork = plans.some(
    (plan) =>
      plan.transactions.length > 0 ||
      plan.nextRunAt !== rules.find((rule) => rule.id === plan.ruleId)?.next_run_at ||
      !plan.stillActive,
  );

  return { rules: plans, transactions, hasWork };
}
