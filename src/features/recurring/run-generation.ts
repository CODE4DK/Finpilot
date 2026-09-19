import type { RecurringRulesRepository } from '@/db/repositories/recurring-rules';
import type { TransactionsRepository } from '@/db/repositories/transactions';

import { planGeneration, type RecurringRuleLike } from './generate';

/**
 * Applies what the rules owe. Called once on app open, after the local
 * database is ready.
 *
 * The write side is deliberately dull: the interesting decisions are all in
 * `planGeneration`, which is pure and tested. This only applies the plan, and
 * it is safe to run twice - deterministic ids plus INSERT OR IGNORE mean a
 * second run inserts nothing.
 */

export interface GenerationOutcome {
  created: number;
  rulesAdvanced: number;
  rulesRetired: number;
  truncated: boolean;
}

export interface RunGenerationDeps {
  rules: RecurringRulesRepository;
  transactions: TransactionsRepository;
  now?: Date;
}

export async function runRecurringGeneration({
  rules,
  transactions,
  now = new Date(),
}: RunGenerationDeps): Promise<GenerationOutcome> {
  const due = (await rules.listDue(now.toISOString())) as unknown as RecurringRuleLike[];

  const plan = planGeneration(due, now);
  if (!plan.hasWork) {
    return { created: 0, rulesAdvanced: 0, rulesRetired: 0, truncated: false };
  }

  let created = 0;
  let rulesAdvanced = 0;
  let rulesRetired = 0;

  for (const rulePlan of plan.rules) {
    for (const generated of rulePlan.transactions) {
      await transactions.insertGenerated({
        id: generated.id,
        type: generated.type,
        amount_paise: generated.amount_paise,
        account_id: generated.account_id,
        to_account_id: generated.to_account_id,
        category_id: generated.category_id,
        note: generated.note,
        occurred_at: generated.occurred_at,
        recurring_rule_id: generated.recurring_rule_id,
      });
      created += 1;
    }

    if (rulePlan.nextRunAt) {
      await rules.update(rulePlan.ruleId, { next_run_at: rulePlan.nextRunAt });
      rulesAdvanced += 1;
    } else {
      // Nowhere left to run: retire it rather than checking it every launch.
      await rules.update(rulePlan.ruleId, { is_active: 0 });
      rulesRetired += 1;
    }
  }

  return {
    created,
    rulesAdvanced,
    rulesRetired,
    truncated: plan.rules.some((rulePlan) => rulePlan.truncated),
  };
}
