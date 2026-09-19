/**
 * The schema stores enumerated values as TEXT with CHECK constraints (see the
 * note at the top of the initial migration). These constants are the client
 * side of that contract: the generated types can only say `string`, so app
 * code should narrow through these unions and guards.
 *
 * Keep them in step with the CHECK constraints in
 * supabase/migrations/20260919090000_initial_schema.sql.
 */

export const ACCOUNT_TYPES = ['cash', 'bank', 'card', 'upi_wallet'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const CATEGORY_TYPES = ['income', 'expense'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const GOAL_STATUSES = ['active', 'completed', 'archived'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

function memberOf<T extends string>(values: readonly T[]) {
  const set = new Set<string>(values);
  return (value: string): value is T => set.has(value);
}

export const isAccountType = memberOf(ACCOUNT_TYPES);
export const isCategoryType = memberOf(CATEGORY_TYPES);
export const isTransactionType = memberOf(TRANSACTION_TYPES);
export const isRecurrenceFrequency = memberOf(RECURRENCE_FREQUENCIES);
export const isGoalStatus = memberOf(GOAL_STATUSES);

/** A transfer moves money between accounts, so it is never categorised. */
export function requiresCategory(type: TransactionType): boolean {
  return type !== 'transfer';
}

/** Only a transfer carries a destination account. */
export function requiresDestinationAccount(type: TransactionType): boolean {
  return type === 'transfer';
}

/** How a transaction moves the balance of `account_id`. */
export function signOf(type: TransactionType): -1 | 1 {
  return type === 'income' ? 1 : -1;
}
