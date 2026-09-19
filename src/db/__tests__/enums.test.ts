import {
  ACCOUNT_TYPES,
  CATEGORY_TYPES,
  GOAL_STATUSES,
  RECURRENCE_FREQUENCIES,
  TRANSACTION_TYPES,
  isAccountType,
  isCategoryType,
  isGoalStatus,
  isRecurrenceFrequency,
  isTransactionType,
  requiresCategory,
  requiresDestinationAccount,
  signOf,
} from '@/db/enums';

describe('enumerated values', () => {
  it('matches the CHECK constraints in the migration', () => {
    expect(ACCOUNT_TYPES).toEqual(['cash', 'bank', 'card', 'upi_wallet']);
    expect(CATEGORY_TYPES).toEqual(['income', 'expense']);
    expect(TRANSACTION_TYPES).toEqual(['income', 'expense', 'transfer']);
    expect(RECURRENCE_FREQUENCIES).toEqual(['daily', 'weekly', 'monthly', 'yearly']);
    expect(GOAL_STATUSES).toEqual(['active', 'completed', 'archived']);
  });
});

describe('type guards', () => {
  it.each([
    [isAccountType, 'bank', 'crypto'],
    [isCategoryType, 'income', 'transfer'],
    [isTransactionType, 'transfer', 'refund'],
    [isRecurrenceFrequency, 'monthly', 'fortnightly'],
    [isGoalStatus, 'archived', 'paused'],
  ] as const)('accepts the valid value and rejects the invalid one', (guard, valid, invalid) => {
    expect(guard(valid)).toBe(true);
    expect(guard(invalid)).toBe(false);
    expect(guard('')).toBe(false);
  });
});

describe('transaction shape helpers', () => {
  it('requires a category for income and expense, never for a transfer', () => {
    expect(requiresCategory('income')).toBe(true);
    expect(requiresCategory('expense')).toBe(true);
    expect(requiresCategory('transfer')).toBe(false);
  });

  it('requires a destination account only for a transfer', () => {
    expect(requiresDestinationAccount('transfer')).toBe(true);
    expect(requiresDestinationAccount('income')).toBe(false);
    expect(requiresDestinationAccount('expense')).toBe(false);
  });

  it('signs the source account movement', () => {
    expect(signOf('income')).toBe(1);
    expect(signOf('expense')).toBe(-1);
    // A transfer leaves the source account, so it is negative there too.
    expect(signOf('transfer')).toBe(-1);
  });
});
