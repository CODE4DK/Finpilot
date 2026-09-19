import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { getPowerSync } from '@/db/powersync';
import { useAppLockStore } from '@/features/app-lock/app-lock-store';
import { useAuthStore } from '@/features/auth/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
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

/**
 * The three shared form screens, driven through their real routes.
 *
 * Each test arrives at the form the way a user does - from the list screen -
 * rather than mounting the route directly, because a form that saves calls
 * `router.back()`, and a stack with no history cannot go back.
 *
 * Each one is the same shape - a draft, a validation gate, a write - and each
 * is where a bad row would be born, so the assertions are about what reaches
 * the database and what is refused before it gets there.
 */

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

let powersync: FakePowerSync;

function writes(prefix: string) {
  return powersync.execute.mock.calls.filter(([sql]) => String(sql).startsWith(prefix));
}

async function openAccountForm() {
  await renderRouter('app', { initialUrl: '/accounts' });
  await screen.findByLabelText('Accounts screen');
  // The empty state and the footer both offer it; either does.
  await fireEvent.press(screen.getAllByLabelText('Add account')[0]!);
  await screen.findByLabelText('New account screen');
}

/** The form's own save button, not the list's entry point of the same name. */
function saveAccountButton() {
  const candidates = screen.getAllByLabelText('Add account');
  return candidates[candidates.length - 1]!;
}

async function openCategoryForm() {
  await renderRouter('app', { initialUrl: '/categories' });
  await screen.findByLabelText('Categories screen');
  await fireEvent.press(screen.getByLabelText('Add category'));
  await screen.findByLabelText('New category screen');
}

async function openBudgetForm() {
  await renderRouter('app', { initialUrl: '/budgets' });
  await screen.findByLabelText('Budgets screen');
  await fireEvent.press(screen.getByLabelText('Set a budget'));
  await screen.findByLabelText('New budget screen');
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().reset();
  useAppLockStore.getState().reset();
  useSettingsStore.getState().reset();
  mockSupabase = createFakeSupabase({ session: makeSession(), profile: makeProfile() });

  powersync = getPowerSync() as unknown as FakePowerSync;
  powersync.clearRows();
  powersync.setRows('FROM categories', [CATEGORY]);
  powersync.execute.mockResolvedValue({ rowsAffected: 1 });
});

describe('the account form', () => {
  it('will not save a nameless account', async () => {
    await openAccountForm();

    expect(saveAccountButton()).toBeDisabled();
    expect(writes('INSERT INTO accounts')).toHaveLength(0);
  });

  it('writes the account once it has a name', async () => {
    await openAccountForm();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'HDFC Salary');
    await fireEvent.press(saveAccountButton());

    await waitFor(() => expect(writes('INSERT INTO accounts')).toHaveLength(1));
    expect(writes('INSERT INTO accounts')[0]![1]).toContain('HDFC Salary');
  });

  it('explains a name the database would refuse', async () => {
    await openAccountForm();

    // 80 characters is the CHECK constraint; the form says so first - once
    // the field has been left, which is when a message stops being nagging.
    await fireEvent.changeText(screen.getByLabelText('Name'), 'a'.repeat(81));
    await fireEvent(screen.getByLabelText('Name'), 'blur');

    expect(await screen.findByText('That name is too long.')).toBeOnTheScreen();
    expect(saveAccountButton()).toBeDisabled();
    expect(writes('INSERT INTO accounts')).toHaveLength(0);
  });

  it('offers every account type the schema allows', async () => {
    await openAccountForm();

    for (const label of ['Bank account', 'Cash', 'Credit card', 'UPI wallet']) {
      expect(screen.getByLabelText(label)).toBeOnTheScreen();
    }
  });

  it('records the opening balance a card starts in the red with', async () => {
    await openAccountForm();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Amex');
    await fireEvent.press(screen.getByLabelText('Credit card'));
    await fireEvent.changeText(screen.getByLabelText('Opening balance'), '-2500');
    await fireEvent.press(saveAccountButton());

    await waitFor(() => expect(writes('INSERT INTO accounts')).toHaveLength(1));
    // Integer paise, negative, exactly as typed.
    expect(writes('INSERT INTO accounts')[0]![1]).toContain(-250000);
  });
});

describe('the category form', () => {
  it('will not save a nameless category', async () => {
    await openCategoryForm();

    expect(screen.getByLabelText('Add category')).toBeDisabled();
  });

  it('writes the category with its type and glyph', async () => {
    await openCategoryForm();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Chai');
    await fireEvent.press(screen.getByLabelText('Add category'));

    await waitFor(() => expect(writes('INSERT INTO categories')).toHaveLength(1));
    const parameters = writes('INSERT INTO categories')[0]![1] as unknown[];
    expect(parameters).toContain('Chai');
    expect(parameters).toContain('expense');
  });

  it('can make an income category instead', async () => {
    await openCategoryForm();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Freelance');
    await fireEvent.press(screen.getByLabelText('Income category'));
    await fireEvent.press(screen.getByLabelText('Add category'));

    await waitFor(() => expect(writes('INSERT INTO categories')).toHaveLength(1));
    expect(writes('INSERT INTO categories')[0]![1]).toContain('income');
  });
});

describe('the budget form', () => {
  it('needs a category and a limit before it will save', async () => {
    await openBudgetForm();

    expect(screen.getByLabelText('Set budget')).toBeDisabled();
  });

  it('writes a budget for the chosen category', async () => {
    await openBudgetForm();

    await fireEvent.press(screen.getByLabelText('Budget for Food'));
    await fireEvent.changeText(screen.getByLabelText('Monthly limit'), '10000');
    await fireEvent.press(screen.getByLabelText('Set budget'));

    await waitFor(() => expect(writes('INSERT INTO budgets')).toHaveLength(1));
    const parameters = writes('INSERT INTO budgets')[0]![1] as unknown[];
    expect(parameters).toContain('cat-food');
    expect(parameters).toContain(1000000);
  });

  it('refuses a zero limit, which the database would refuse too', async () => {
    await openBudgetForm();

    await fireEvent.press(screen.getByLabelText('Budget for Food'));
    await fireEvent.changeText(screen.getByLabelText('Monthly limit'), '0');

    await act(async () => {});
    expect(screen.getByLabelText('Set budget')).toBeDisabled();
    expect(writes('INSERT INTO budgets')).toHaveLength(0);
  });
});
