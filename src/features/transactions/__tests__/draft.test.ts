import {
  canSave,
  createDraft,
  describeProblem,
  remainingTapsToSave,
  setType,
  toRecurringRuleValues,
  toTransactionValues,
  validateDraft,
  type TransactionDraft,
} from '@/features/transactions/draft';

const NOW = new Date(2026, 8, 19, 15, 30);

function draft(overrides: Partial<TransactionDraft> = {}): TransactionDraft {
  return {
    ...createDraft({ lastAccountId: 'acc-1', now: NOW }),
    amountPaise: 184550,
    categoryId: 'cat-food',
    ...overrides,
  };
}

describe('createDraft', () => {
  it('defaults to an expense', () => {
    expect(createDraft().type).toBe('expense');
  });

  it('defaults the account to the last one used', () => {
    expect(createDraft({ lastAccountId: 'acc-9', firstAccountId: 'acc-1' }).accountId).toBe(
      'acc-9',
    );
  });

  it('falls back to the first account when there is no history', () => {
    expect(createDraft({ firstAccountId: 'acc-1' }).accountId).toBe('acc-1');
  });

  it('defaults the date to now', () => {
    expect(createDraft({ now: NOW }).occurredAt).toBe(NOW);
  });

  it('starts with no amount, category or repeat', () => {
    const fresh = createDraft();
    expect(fresh.amountPaise).toBeNull();
    expect(fresh.categoryId).toBeNull();
    expect(fresh.recurrence).toBeNull();
  });
});

describe('the two-tap target', () => {
  it('needs only a category and Save once the amount is typed', () => {
    const typed = { ...createDraft({ lastAccountId: 'acc-1', now: NOW }), amountPaise: 184550 };

    expect(remainingTapsToSave(typed)).toBe(2);
  });

  it('is one tap when the category is already chosen', () => {
    expect(remainingTapsToSave(draft())).toBe(1);
  });

  it('costs an extra tap when there is no default account', () => {
    const noAccount = { ...createDraft({ now: NOW }), amountPaise: 184550 };
    expect(remainingTapsToSave(noAccount)).toBe(3);
  });

  it('costs a destination tap for a transfer, and no category tap', () => {
    const transfer = setType(draft({ categoryId: null }), 'transfer');
    expect(remainingTapsToSave(transfer)).toBe(2);
  });

  it('is one tap for income with a category chosen', () => {
    expect(remainingTapsToSave(setType(draft(), 'income'))).toBe(1);
  });
});

describe('setType', () => {
  it('clears the category when switching to a transfer', () => {
    const transfer = setType(draft(), 'transfer');
    expect(transfer.categoryId).toBeNull();
  });

  it('clears the destination when switching away from a transfer', () => {
    const transfer = setType(draft({ categoryId: null }), 'transfer');
    const withDestination = { ...transfer, toAccountId: 'acc-2' };

    expect(setType(withDestination, 'expense').toAccountId).toBeNull();
  });

  it('keeps the category when switching between income and expense', () => {
    expect(setType(draft(), 'income').categoryId).toBe('cat-food');
  });

  it('is a no-op when the type is unchanged', () => {
    const original = draft();
    expect(setType(original, 'expense')).toBe(original);
  });

  it('keeps the amount, account, note and date', () => {
    const original = draft({ note: 'chai' });
    const switched = setType(original, 'income');

    expect(switched.amountPaise).toBe(original.amountPaise);
    expect(switched.accountId).toBe(original.accountId);
    expect(switched.note).toBe('chai');
    expect(switched.occurredAt).toBe(original.occurredAt);
  });
});

describe('validateDraft', () => {
  it('accepts a complete expense', () => {
    expect(validateDraft(draft())).toEqual([]);
    expect(canSave(draft())).toBe(true);
  });

  it('requires an amount', () => {
    expect(validateDraft(draft({ amountPaise: null }))).toContain('amount_missing');
  });

  it('requires a positive amount', () => {
    expect(validateDraft(draft({ amountPaise: 0 }))).toContain('amount_not_positive');
    expect(validateDraft(draft({ amountPaise: -100 }))).toContain('amount_not_positive');
  });

  it('requires an account', () => {
    expect(validateDraft(draft({ accountId: null }))).toContain('account_missing');
  });

  it('requires a category for income and expense', () => {
    expect(validateDraft(draft({ categoryId: null }))).toContain('category_missing');
    expect(validateDraft(setType(draft({ categoryId: null }), 'income'))).toContain(
      'category_missing',
    );
  });

  it('requires a destination for a transfer', () => {
    const transfer = setType(draft(), 'transfer');
    expect(validateDraft(transfer)).toContain('destination_missing');
  });

  it('refuses a transfer to the same account', () => {
    const transfer = { ...setType(draft(), 'transfer'), toAccountId: 'acc-1' };
    expect(validateDraft(transfer)).toContain('destination_same_as_source');
  });

  it('accepts a complete transfer, with no category', () => {
    const transfer = { ...setType(draft(), 'transfer'), toAccountId: 'acc-2' };
    expect(validateDraft(transfer)).toEqual([]);
  });

  it('reports every problem at once', () => {
    const empty = createDraft();
    expect(validateDraft(empty)).toEqual(['amount_missing', 'account_missing', 'category_missing']);
  });

  it('gives every problem a message a user can act on', () => {
    for (const problem of validateDraft(createDraft())) {
      expect(describeProblem(problem).length).toBeGreaterThan(0);
    }
  });
});

describe('toTransactionValues', () => {
  it('produces the row the repository writes', () => {
    expect(toTransactionValues(draft({ note: '  Groceries  ' }))).toEqual({
      type: 'expense',
      amount_paise: 184550,
      account_id: 'acc-1',
      to_account_id: null,
      category_id: 'cat-food',
      note: 'Groceries',
      occurred_at: NOW.toISOString(),
    });
  });

  it('stores an empty note as null, not an empty string', () => {
    expect(toTransactionValues(draft({ note: '   ' })).note).toBeNull();
  });

  it('keeps the amount an integer number of paise', () => {
    const values = toTransactionValues(draft());
    expect(Number.isInteger(values.amount_paise)).toBe(true);
  });

  it('drops the category from a transfer', () => {
    const transfer = { ...setType(draft(), 'transfer'), toAccountId: 'acc-2' };
    const values = toTransactionValues(transfer);

    expect(values.category_id).toBeNull();
    expect(values.to_account_id).toBe('acc-2');
  });

  it('refuses to build values from an invalid draft', () => {
    expect(() => toTransactionValues(createDraft())).toThrow(/not ready to save/);
  });
});

describe('toRecurringRuleValues', () => {
  const nextRun = new Date(2026, 9, 19, 15, 30);

  it('copies the draft onto the rule template', () => {
    const repeating = draft({
      recurrence: { frequency: 'monthly', interval: 1, endAt: null },
      note: 'Rent',
    });

    expect(toRecurringRuleValues(repeating, nextRun)).toEqual({
      type: 'expense',
      amount_paise: 184550,
      account_id: 'acc-1',
      to_account_id: null,
      category_id: 'cat-food',
      note: 'Rent',
      frequency: 'monthly',
      interval: 1,
      next_run_at: nextRun.toISOString(),
      end_at: null,
    });
  });

  it('starts the rule at the next occurrence, not this one', () => {
    const repeating = draft({ recurrence: { frequency: 'monthly', interval: 1, endAt: null } });
    const values = toRecurringRuleValues(repeating, nextRun);

    // The transaction being saved covers today; the rule picks up after it.
    expect(new Date(values.next_run_at).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('carries an end date', () => {
    const endAt = new Date(2027, 0, 1);
    const repeating = draft({ recurrence: { frequency: 'weekly', interval: 2, endAt } });

    expect(toRecurringRuleValues(repeating, nextRun).end_at).toBe(endAt.toISOString());
  });

  it('refuses when the draft has no recurrence', () => {
    expect(() => toRecurringRuleValues(draft(), nextRun)).toThrow(/no recurrence/);
  });
});
