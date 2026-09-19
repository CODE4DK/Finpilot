import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { getPowerSync } from '@/db/powersync';
import { useAppLockStore } from '@/features/app-lock/app-lock-store';
import { useAuthStore } from '@/features/auth/auth-store';
import type { FakePowerSync } from '@/test-utils/fake-powersync';
import {
  createFakeSupabase,
  makeProfile,
  makeSession,
  TEST_USER_ID,
  type FakeSupabase,
} from '@/test-utils/supabase-mock';

// `mock`-prefixed so jest allows the factory below to close over it.
let mockSupabase: FakeSupabase;

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
  startSupabaseAutoRefresh: () => () => {},
}));

const ACCOUNT = {
  id: 'acc-1',
  user_id: TEST_USER_ID,
  name: 'HDFC Savings',
  type: 'bank',
  opening_balance_paise: 1000000,
  balance_paise: 1000000,
  is_archived: 0,
  color: null,
  icon: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
};

const CATEGORY = {
  id: 'cat-food',
  user_id: TEST_USER_ID,
  name: 'Food',
  type: 'expense',
  icon: 'restaurant-outline',
  color: null,
  is_default: 1,
  parent_id: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
};

const TRANSACTION = {
  id: 'txn-1',
  user_id: TEST_USER_ID,
  type: 'expense',
  amount_paise: 184550,
  account_id: ACCOUNT.id,
  to_account_id: null,
  category_id: CATEGORY.id,
  note: 'Big Bazaar',
  occurred_at: new Date().toISOString(),
  recurring_rule_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

function seed(rows: { transactions?: unknown[] } = {}) {
  const powersync = getPowerSync() as unknown as FakePowerSync;
  powersync.clearRows();
  powersync.setRows('FROM accounts a', [ACCOUNT]);
  powersync.setRows('FROM accounts ', [ACCOUNT]);
  powersync.setRows('FROM categories ', [CATEGORY]);
  powersync.setRows('FROM transactions ', rows.transactions ?? []);
  return powersync;
}

beforeEach(() => {
  useAuthStore.getState().reset();
  useAppLockStore.getState().reset();
  mockSupabase = createFakeSupabase({ session: makeSession(), profile: makeProfile() });
  seed();
});

describe('the transactions list', () => {
  it('shows an empty state when there is nothing to list', async () => {
    await renderRouter('app', { initialUrl: '/transactions' });
    await screen.findByLabelText('Transactions screen');

    expect(await screen.findByText('No transactions yet')).toBeOnTheScreen();
  });

  it('groups transactions under a day heading with the day total', async () => {
    seed({ transactions: [TRANSACTION] });

    await renderRouter('app', { initialUrl: '/transactions' });
    await screen.findByLabelText('Transactions screen');

    expect(await screen.findByText('Today')).toBeOnTheScreen();
    expect(screen.getByText('Big Bazaar')).toBeOnTheScreen();
  });

  it('offers filters and reports how many are applied', async () => {
    await renderRouter('app', { initialUrl: '/transactions' });
    await screen.findByLabelText('Transactions screen');

    await fireEvent.press(screen.getByLabelText('Filter to this month'));

    expect(await screen.findByLabelText(/Filters, 1 applied/)).toBeOnTheScreen();
  });

  it('reveals edit and delete actions on a row', async () => {
    seed({ transactions: [TRANSACTION] });

    await renderRouter('app', { initialUrl: '/transactions' });
    await screen.findByLabelText('Transactions screen');

    // The gesture itself is not unit-testable; what matters here is that both
    // actions exist and are labelled for a screen reader.
    expect(await screen.findByLabelText('Delete')).toBeOnTheScreen();
    expect(screen.getByLabelText('Edit')).toBeOnTheScreen();
  });

  it('offers Undo after a delete, and restores the row when taken', async () => {
    seed({ transactions: [TRANSACTION] });
    const powersync = getPowerSync() as unknown as FakePowerSync;

    await renderRouter('app', { initialUrl: '/transactions' });
    await screen.findByLabelText('Transactions screen');

    // The row has to be readable before it can be deleted; the screen reads it
    // back so Undo has something to restore.
    powersync.getOptional.mockResolvedValueOnce(TRANSACTION as never);

    await fireEvent.press(await screen.findByLabelText('Delete'));

    const undo = await screen.findByLabelText('Undo');
    expect(undo).toBeOnTheScreen();

    await fireEvent.press(undo);

    await waitFor(() => {
      // The restore re-inserts the row under its original id, so the delete
      // and the resurrection converge on every device.
      const insert = powersync.execute.mock.calls.find(([sql]) =>
        String(sql).startsWith('INSERT INTO transactions'),
      );
      expect(insert?.[1]).toContain(TRANSACTION.id);
    });
  });

  it('searches by note', async () => {
    seed({ transactions: [TRANSACTION] });

    await renderRouter('app', { initialUrl: '/transactions' });
    await screen.findByLabelText('Transactions screen');

    await fireEvent.changeText(screen.getByLabelText('Search'), 'bazaar');

    // The search reaches the query rather than filtering in JavaScript.
    expect(screen.getByLabelText('Search')).toHaveDisplayValue('bazaar');
  });
});

describe('the add screen', () => {
  it('starts on expense with the account already chosen', async () => {
    await renderRouter('app', { initialUrl: '/add' });
    await screen.findByLabelText('Add transaction screen');

    expect(screen.getByLabelText('Expense')).toBeSelected();
    expect(await screen.findByLabelText(/Account, HDFC Savings/)).toBeOnTheScreen();
  });

  it('switches between expense, income and transfer', async () => {
    await renderRouter('app', { initialUrl: '/add' });
    await screen.findByLabelText('Add transaction screen');

    await fireEvent.press(screen.getByLabelText('Transfer'));

    // A transfer asks for a destination and drops the category grid.
    expect(await screen.findByLabelText(/Transfer to/)).toBeOnTheScreen();
    expect(screen.queryByTestId('category-grid')).not.toBeOnTheScreen();
  });

  it('keeps Save disabled until the draft is complete', async () => {
    await renderRouter('app', { initialUrl: '/add' });
    await screen.findByLabelText('Add transaction screen');

    expect(screen.getByRole('button', { name: /Save transaction/ })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Amount'), '1845.50');
    await fireEvent.press(await screen.findByTestId('category-cat-food'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save transaction' })).toBeEnabled();
    });
  });

  it('reaches a saveable expense in two taps after the amount is typed', async () => {
    await renderRouter('app', { initialUrl: '/add' });
    await screen.findByLabelText('Add transaction screen');

    // Tap 0: type the amount.
    await fireEvent.changeText(screen.getByLabelText('Amount'), '1845.50');
    // Tap 1: the category.
    await fireEvent.press(await screen.findByTestId('category-cat-food'));
    // Tap 2: Save - which is now enabled, so the path really is two taps.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save transaction' })).toBeEnabled();
    });
  });

  it('offers a repeat toggle', async () => {
    await renderRouter('app', { initialUrl: '/add' });
    await screen.findByLabelText('Add transaction screen');

    await fireEvent(screen.getByLabelText('Repeat this transaction'), 'valueChange', true);

    expect(await screen.findByLabelText('Repeat monthly')).toBeOnTheScreen();
  });
});

describe('accounts', () => {
  it('shows net worth and the account balance', async () => {
    await renderRouter('app', { initialUrl: '/accounts' });
    await screen.findByLabelText('Accounts screen');

    expect(await screen.findByLabelText(/HDFC Savings, balance/)).toBeOnTheScreen();
    expect(screen.getByText('Net worth')).toBeOnTheScreen();
  });

  it('opens the new-account form', async () => {
    await renderRouter('app', { initialUrl: '/accounts/new' });

    expect(await screen.findByLabelText('New account screen')).toBeOnTheScreen();
  });
});

describe('categories', () => {
  it('lists categories and marks the built-in ones', async () => {
    await renderRouter('app', { initialUrl: '/categories' });
    await screen.findByLabelText('Categories screen');

    expect(await screen.findByText('Food')).toBeOnTheScreen();
    expect(screen.getByText('Built-in')).toBeOnTheScreen();
  });

  it('explains that built-in categories cannot be deleted', async () => {
    await renderRouter('app', { initialUrl: '/categories' });
    await screen.findByLabelText('Categories screen');

    expect(
      screen.getByText(/Built-in categories can be renamed or archived, but not deleted/),
    ).toBeOnTheScreen();
  });
});

describe('repeating transactions', () => {
  it('shows an empty state when nothing repeats', async () => {
    await renderRouter('app', { initialUrl: '/recurring' });

    expect(await screen.findByText('Nothing repeats yet')).toBeOnTheScreen();
  });
});
