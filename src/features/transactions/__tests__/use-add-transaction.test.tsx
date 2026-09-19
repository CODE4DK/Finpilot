import { act, waitFor } from '@testing-library/react-native';

import { renderHookWithDatabase } from '@/test-utils/render';

import { getPowerSync } from '@/db/powersync';
import { useAuthStore } from '@/features/auth/auth-store';
import { useAddTransaction } from '@/features/transactions/use-add-transaction';
import type { FakePowerSync } from '@/test-utils/fake-powersync';
import { makeSession, TEST_USER_ID } from '@/test-utils/supabase-mock';

/**
 * The Add screen's brain, without the screen.
 *
 * What is worth asserting here is the defaulting - the account that arrives
 * from the last saved transaction, the category list reordered by use - and
 * the save path, including the repeating rule that has to start at the *next*
 * occurrence rather than today's.
 */

function account(id: string, name: string, archived = 0) {
  return {
    id,
    user_id: TEST_USER_ID,
    name,
    type: 'bank',
    opening_balance_paise: 0,
    color: null,
    icon: null,
    is_archived: archived,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
  };
}

function category(id: string, name: string, type: 'income' | 'expense') {
  return {
    id,
    user_id: TEST_USER_ID,
    name,
    type,
    icon: null,
    color: null,
    is_default: 1,
    parent_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
  };
}

let powersync: FakePowerSync;

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().reset();
  useAuthStore.getState().setSession(makeSession());

  powersync = getPowerSync() as unknown as FakePowerSync;
  powersync.clearRows();
  powersync.setRows('FROM accounts', [
    account('acc-1', 'HDFC'),
    account('acc-2', 'Cash'),
    account('acc-archived', 'Old', 1),
  ]);
  powersync.setRows('FROM categories', [
    category('cat-food', 'Food', 'expense'),
    category('cat-rent', 'Rent', 'expense'),
    category('cat-salary', 'Salary', 'income'),
  ]);
  powersync.getOptional.mockResolvedValue({ account_id: 'acc-2' });
  powersync.execute.mockResolvedValue({ rowsAffected: 1 });
});

describe('defaults', () => {
  it('starts as an expense, dated now', async () => {
    const { result } = await renderHookWithDatabase(() => useAddTransaction());

    expect(result.current.draft.type).toBe('expense');
    expect(result.current.draft.occurredAt).toBeInstanceOf(Date);
  });

  it('defaults the account to the one last saved against', async () => {
    const { result } = await renderHookWithDatabase(() => useAddTransaction());

    await waitFor(() => {
      expect(result.current.draft.accountId).toBe('acc-2');
    });
  });

  it('hides archived accounts from the picker', async () => {
    const { result } = await renderHookWithDatabase(() => useAddTransaction());

    await waitFor(() => expect(result.current.accounts.length).toBeGreaterThan(0));
    expect(result.current.accounts.map((row) => row.id)).toEqual(['acc-1', 'acc-2']);
  });

  it('shows expense categories for an expense and income ones for income', async () => {
    const { result } = await renderHookWithDatabase(() => useAddTransaction());

    await waitFor(() => expect(result.current.categories.length).toBeGreaterThan(0));
    expect(result.current.categories.map((row) => row.name)).toEqual(['Food', 'Rent']);

    await act(async () => {
      result.current.setType('income');
    });

    expect(result.current.categories.map((row) => row.name)).toEqual(['Salary']);
  });

  it('puts recently used categories first', async () => {
    const { result } = await renderHookWithDatabase(() =>
      useAddTransaction([
        { category_id: 'cat-rent', last_used_at: '2026-09-19T00:00:00.000Z', uses: 4 },
      ]),
    );

    await waitFor(() => expect(result.current.categories.length).toBe(2));
    expect(result.current.categories[0]!.name).toBe('Rent');
  });
});

describe('the draft', () => {
  it('cannot be saved until it is complete', async () => {
    const { result } = await renderHookWithDatabase(() => useAddTransaction());
    await waitFor(() => expect(result.current.draft.accountId).toBe('acc-2'));

    expect(result.current.canSave).toBe(false);
    expect(result.current.problems).toContain('amount_missing');

    await act(async () => {
      result.current.setAmount(50000);
    });
    await act(async () => {
      result.current.setCategory('cat-food');
    });

    expect(result.current.canSave).toBe(true);
  });

  it('drops the category when the type becomes a transfer', async () => {
    const { result } = await renderHookWithDatabase(() => useAddTransaction());
    await waitFor(() => expect(result.current.draft.accountId).toBe('acc-2'));

    await act(async () => {
      result.current.setCategory('cat-food');
    });
    await act(async () => {
      result.current.setType('transfer');
    });

    // A transfer moves money between your own accounts, so it is never
    // categorised.
    expect(result.current.draft.categoryId).toBeNull();
  });

  it('needs a destination for a transfer, and a different one', async () => {
    const { result } = await renderHookWithDatabase(() => useAddTransaction());
    await waitFor(() => expect(result.current.draft.accountId).toBe('acc-2'));

    await act(async () => {
      result.current.setType('transfer');
    });
    await act(async () => {
      result.current.setAmount(50000);
    });

    expect(result.current.problems).toContain('destination_missing');

    await act(async () => {
      result.current.setToAccount('acc-2');
    });
    expect(result.current.problems).toContain('destination_same_as_source');

    await act(async () => {
      result.current.setToAccount('acc-1');
    });
    expect(result.current.canSave).toBe(true);
  });

  it('keeps the account when it resets, so the next entry is still two taps', async () => {
    const { result } = await renderHookWithDatabase(() => useAddTransaction());
    await waitFor(() => expect(result.current.draft.accountId).toBe('acc-2'));

    await act(async () => {
      result.current.setAmount(50000);
    });
    await act(async () => {
      result.current.setNote('Lunch');
    });
    await act(async () => {
      result.current.reset();
    });

    expect(result.current.draft.amountPaise).toBeNull();
    expect(result.current.draft.note).toBe('');
    expect(result.current.draft.accountId).toBe('acc-2');
  });
});

describe('saving', () => {
  it('writes the transaction and returns its id', async () => {
    const { result } = await renderHookWithDatabase(() => useAddTransaction());
    await waitFor(() => expect(result.current.draft.accountId).toBe('acc-2'));

    await act(async () => {
      result.current.setAmount(50000);
    });
    await act(async () => {
      result.current.setCategory('cat-food');
    });

    let id: string | null = null;
    await act(async () => {
      id = await result.current.save();
    });

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const insert = powersync.execute.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO transactions'),
    );
    expect(insert).toBeDefined();
  });

  it('refuses to save an incomplete draft rather than writing a bad row', async () => {
    const { result } = await renderHookWithDatabase(() => useAddTransaction());
    await waitFor(() => expect(result.current.draft.accountId).toBe('acc-2'));

    let id: string | null = 'not-null';
    await act(async () => {
      id = await result.current.save();
    });

    expect(id).toBeNull();
    expect(powersync.execute).not.toHaveBeenCalled();
  });

  it('starts a repeating rule at the next occurrence, not at today', async () => {
    const { result } = await renderHookWithDatabase(() => useAddTransaction());
    await waitFor(() => expect(result.current.draft.accountId).toBe('acc-2'));

    await act(async () => {
      result.current.setAmount(250000);
    });
    await act(async () => {
      result.current.setCategory('cat-rent');
    });
    await act(async () => {
      result.current.setOccurredAt(new Date(2026, 8, 5, 10, 0));
    });
    await act(async () => {
      result.current.setRecurrence({ frequency: 'monthly', interval: 1, endAt: null });
    });

    await act(async () => {
      await result.current.save();
    });

    const ruleInsert = powersync.execute.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO recurring_rules'),
    );
    expect(ruleInsert).toBeDefined();

    // The transaction being saved covers 5 September, so the rule's first run
    // is 5 October.
    const parameters = ruleInsert![1] as unknown[];
    const nextRunAt = parameters.find(
      (value) => typeof value === 'string' && value.startsWith('2026-10-05'),
    );
    expect(nextRunAt).toBeDefined();

    // ...and the transaction is linked back to the rule it created.
    const update = powersync.execute.mock.calls.find(([sql]) =>
      String(sql).startsWith('UPDATE transactions'),
    );
    expect(String(update?.[0])).toContain('recurring_rule_id');
  });
});
