import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Sharing from 'expo-sharing';

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

function category(id: string, name: string, icon = 'fast-food-outline') {
  return {
    id,
    user_id: TEST_USER_ID,
    name,
    type: 'expense',
    icon,
    color: null,
    is_default: 1,
    parent_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
  };
}

const CATEGORIES = [category('cat-food', 'Food'), category('cat-rent', 'Rent', 'home-outline')];

interface Seed {
  totals?: unknown[];
  spend?: unknown[];
  trend?: unknown[];
  changes?: unknown[];
  top?: unknown[];
}

function seed(rows: Seed = {}) {
  const powersync = getPowerSync() as unknown as FakePowerSync;
  powersync.clearRows();
  // Fragments are matched in insertion order, so the specific ones go first.
  powersync.setRows('AS expense_count', rows.totals ?? []);
  powersync.setRows('AS txn_count', rows.spend ?? []);
  powersync.setRows('AS month_key', rows.trend ?? []);
  powersync.setRows('AS current_paise', rows.changes ?? []);
  powersync.setRows('SELECT id, amount_paise, note', rows.top ?? []);
  powersync.setRows('FROM categories ', CATEGORIES);
  return powersync;
}

const POPULATED: Seed = {
  totals: [{ income_paise: 9000000, expense_paise: 730000, expense_count: 4 }],
  spend: [
    { category_id: 'cat-rent', spent_paise: 500000, txn_count: 1 },
    { category_id: 'cat-food', spent_paise: 200000, txn_count: 2 },
    { category_id: null, spent_paise: 30000, txn_count: 1 },
  ],
  trend: [{ month_key: '2026-09', income_paise: 9000000, expense_paise: 730000 }],
  changes: [{ category_id: 'cat-food', current_paise: 200000, previous_paise: 100000 }],
  top: [
    {
      id: 'txn-1',
      amount_paise: 500000,
      note: 'September rent',
      occurred_at: '2026-09-01T06:00:00.000Z',
      category_id: 'cat-rent',
      account_id: 'acc-1',
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().reset();
  useAppLockStore.getState().reset();
  useSettingsStore.getState().reset();
  mockSupabase = createFakeSupabase({ session: makeSession(), profile: makeProfile() });
  seed();
});

describe('the reports tab', () => {
  it('offers a way in when there is nothing to report', async () => {
    await renderRouter('app', { initialUrl: '/reports' });
    await screen.findByLabelText('Reports screen');

    expect(await screen.findByText('Nothing to report yet')).toBeOnTheScreen();
  });

  it('ranks the categories with their share and entry count', async () => {
    seed(POPULATED);

    await renderRouter('app', { initialUrl: '/reports' });
    await screen.findByLabelText('Reports screen');

    // 5000 of 7300 rupees.
    expect(await screen.findByLabelText(/Rent, ₹5,000.00, 69% of spending/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Food, ₹2,000.00, 27% of spending/)).toBeOnTheScreen();
    expect(screen.getByText('68.5% · 1 entry')).toBeOnTheScreen();
  });

  it('gives the donut a spoken summary, since a canvas says nothing', async () => {
    seed(POPULATED);

    await renderRouter('app', { initialUrl: '/reports' });
    await screen.findByLabelText('Reports screen');

    expect(
      await screen.findByLabelText(/Spending by category for .*₹7,300 across 3 categories/),
    ).toBeOnTheScreen();
  });

  it('gives the trend chart one too', async () => {
    seed(POPULATED);

    await renderRouter('app', { initialUrl: '/reports' });
    await screen.findByLabelText('Reports screen');

    expect(await screen.findByLabelText(/Income against expense by month for /)).toBeOnTheScreen();
  });

  it('states a rise in words, not with an arrow alone', async () => {
    seed(POPULATED);

    await renderRouter('app', { initialUrl: '/reports' });
    await screen.findByLabelText('Reports screen');

    expect(
      await screen.findByLabelText('Food, ₹2,000, up 100% from ₹1,000 last period.'),
    ).toBeOnTheScreen();
  });

  it('lists the biggest expenses and the daily average', async () => {
    seed(POPULATED);

    await renderRouter('app', { initialUrl: '/reports' });
    await screen.findByLabelText('Reports screen');

    expect(await screen.findByText('September rent')).toBeOnTheScreen();
    expect(screen.getByText(/a day on average over/)).toBeOnTheScreen();
  });

  it('exports the period as a CSV through the share sheet', async () => {
    seed(POPULATED);
    const powersync = getPowerSync() as unknown as FakePowerSync;
    // Only the export's own read - other one-off reads (recurring catch-up,
    // for one) must keep getting their own empty result.
    powersync.getAll.mockImplementation(async (sql: string) =>
      sql.includes('LEFT JOIN categories')
        ? [
            {
              occurred_at: '2026-09-01T06:00:00.000Z',
              type: 'expense',
              amount_paise: 500000,
              category_name: 'Rent',
              account_name: 'HDFC',
              to_account_name: null,
              note: 'September rent',
            },
          ]
        : [],
    );

    await renderRouter('app', { initialUrl: '/reports' });
    await screen.findByLabelText('Reports screen');

    fireEvent.press(await screen.findByLabelText(/Export .* as a CSV file/));

    await screen.findByLabelText('Reports screen');
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/finpilot-.*\.csv$/),
      expect.objectContaining({ mimeType: 'text/csv' }),
    );
  });
  // Last on purpose: renderRouter leaves the router on whatever route a test
  // navigated to, and the next mount comes up empty.
  it('opens the filtered list when a category is tapped', async () => {
    seed(POPULATED);

    await renderRouter('app', { initialUrl: '/reports' });
    await screen.findByLabelText('Reports screen');

    fireEvent.press(await screen.findByLabelText(/^Rent, /));

    expect(await screen.findByLabelText('Rent transactions')).toBeOnTheScreen();
  });
});
