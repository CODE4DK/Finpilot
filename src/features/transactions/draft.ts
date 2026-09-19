import type { TransactionType } from '@/db/enums';
import { requiresCategory, requiresDestinationAccount } from '@/db/enums';

/**
 * The Add screen's state, as data.
 *
 * The design target is **an expense saved in two taps** once the amount is
 * typed: pick a category, press Save. Everything else has to default to
 * something sensible - type is expense, the account is the last one used, the
 * date is now - and `remainingTapsToSave` is what keeps that honest.
 */

export interface TransactionDraft {
  type: TransactionType;
  /** Integer paise, or null while the field is empty. */
  amountPaise: number | null;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
  occurredAt: Date;
  /** Set when the user turns on Repeat. */
  recurrence: DraftRecurrence | null;
}

export interface DraftRecurrence {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endAt: Date | null;
}

export interface DraftDefaults {
  /** The account the user last saved against. */
  lastAccountId?: string | null;
  /** Falls back to this when there is no history. */
  firstAccountId?: string | null;
  now?: Date;
}

export function createDraft(defaults: DraftDefaults = {}): TransactionDraft {
  const { lastAccountId = null, firstAccountId = null, now = new Date() } = defaults;

  return {
    type: 'expense',
    amountPaise: null,
    // Defaulting the account is what removes a tap from the common path.
    accountId: lastAccountId ?? firstAccountId,
    toAccountId: null,
    categoryId: null,
    note: '',
    occurredAt: now,
    recurrence: null,
  };
}

/**
 * Switching type has to clear the fields that no longer apply, or a draft can
 * carry a category into a transfer and be rejected by the database.
 */
export function setType(draft: TransactionDraft, type: TransactionType): TransactionDraft {
  if (draft.type === type) {
    return draft;
  }

  return {
    ...draft,
    type,
    categoryId: requiresCategory(type) ? draft.categoryId : null,
    toAccountId: requiresDestinationAccount(type) ? draft.toAccountId : null,
  };
}

export type DraftProblem =
  | 'amount_missing'
  | 'amount_not_positive'
  | 'account_missing'
  | 'destination_missing'
  | 'destination_same_as_source'
  | 'category_missing';

const PROBLEM_MESSAGES: Record<DraftProblem, string> = {
  amount_missing: 'Enter an amount.',
  amount_not_positive: 'The amount must be more than zero.',
  account_missing: 'Choose an account.',
  destination_missing: 'Choose the account to transfer to.',
  destination_same_as_source: 'Transfer to a different account.',
  category_missing: 'Choose a category.',
};

export function describeProblem(problem: DraftProblem): string {
  return PROBLEM_MESSAGES[problem];
}

/** Everything wrong with the draft, in the order a user would fix it. */
export function validateDraft(draft: TransactionDraft): DraftProblem[] {
  const problems: DraftProblem[] = [];

  if (draft.amountPaise === null) {
    problems.push('amount_missing');
  } else if (draft.amountPaise <= 0) {
    problems.push('amount_not_positive');
  }

  if (!draft.accountId) {
    problems.push('account_missing');
  }

  if (requiresDestinationAccount(draft.type)) {
    if (!draft.toAccountId) {
      problems.push('destination_missing');
    } else if (draft.toAccountId === draft.accountId) {
      problems.push('destination_same_as_source');
    }
  }

  if (requiresCategory(draft.type) && !draft.categoryId) {
    problems.push('category_missing');
  }

  return problems;
}

export function canSave(draft: TransactionDraft): boolean {
  return validateDraft(draft).length === 0;
}

/**
 * How many taps still stand between this draft and a saved transaction,
 * counting Save itself.
 *
 * This is the design target expressed as a function: with the amount typed and
 * the defaults in place, an expense must come out at 2.
 */
export function remainingTapsToSave(draft: TransactionDraft): number {
  let taps = 1; // Save.

  if (requiresCategory(draft.type) && !draft.categoryId) {
    taps += 1;
  }
  if (!draft.accountId) {
    taps += 1;
  }
  if (requiresDestinationAccount(draft.type) && !draft.toAccountId) {
    taps += 1;
  }

  return taps;
}

export interface TransactionValues extends Record<string, unknown> {
  type: TransactionType;
  amount_paise: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note: string | null;
  occurred_at: string;
}

/** Turns a validated draft into the row shape the repository writes. */
export function toTransactionValues(draft: TransactionDraft): TransactionValues {
  const problems = validateDraft(draft);
  if (problems.length > 0) {
    throw new Error(`Draft is not ready to save: ${problems.join(', ')}`);
  }

  return {
    type: draft.type,
    amount_paise: draft.amountPaise!,
    account_id: draft.accountId!,
    to_account_id: requiresDestinationAccount(draft.type) ? draft.toAccountId : null,
    category_id: requiresCategory(draft.type) ? draft.categoryId : null,
    note: draft.note.trim() === '' ? null : draft.note.trim(),
    occurred_at: draft.occurredAt.toISOString(),
  };
}

export interface RecurringRuleValues extends Record<string, unknown> {
  type: TransactionType;
  amount_paise: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note: string | null;
  frequency: DraftRecurrence['frequency'];
  interval: number;
  next_run_at: string;
  end_at: string | null;
}

/**
 * The rule a repeating draft creates. Its first run is the *next* occurrence:
 * the transaction the user is saving right now covers this one.
 */
export function toRecurringRuleValues(
  draft: TransactionDraft,
  nextRunAt: Date,
): RecurringRuleValues {
  if (!draft.recurrence) {
    throw new Error('Draft has no recurrence to save.');
  }
  const values = toTransactionValues(draft);

  return {
    type: values.type,
    amount_paise: values.amount_paise,
    account_id: values.account_id,
    to_account_id: values.to_account_id,
    category_id: values.category_id,
    note: values.note,
    frequency: draft.recurrence.frequency,
    interval: draft.recurrence.interval,
    next_run_at: nextRunAt.toISOString(),
    end_at: draft.recurrence.endAt ? draft.recurrence.endAt.toISOString() : null,
  };
}
