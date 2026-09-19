import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

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

const MONTH = `${new Date().toISOString().slice(0, 7)}-01`;

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

/** An AI insight as the Edge Function stores it: jsonb, so a string here. */
function storedInsight(overrides: Record<string, unknown> = {}) {
  return {
    id: 'insight-1',
    user_id: TEST_USER_ID,
    month: MONTH,
    generated_at: '2026-09-19T06:00:00.000Z',
    created_at: '2026-09-19T06:00:00.000Z',
    updated_at: '2026-09-19T06:00:00.000Z',
    deleted_at: null,
    summary: JSON.stringify({
      summary: 'A steady month so far, with food running ahead of last month.',
      highlights: [{ title: 'Food is up', detail: 'Nine meals out, against four last month.' }],
      unusual_spend: [{ category: 'Food', detail: 'Up 82% on last month.', severity: 'medium' }],
      suggestions: [{ title: 'Set a food budget', detail: 'A limit makes it visible early.' }],
      source: 'ai',
      model: 'claude-opus-5',
      generated_at: '2026-09-19T06:00:00.000Z',
      ...overrides,
    }),
  };
}

function seed(
  rows: {
    insights?: unknown[];
    totals?: unknown[];
    spend?: unknown[];
    optedIn?: boolean;
    connected?: boolean;
  } = {},
) {
  const powersync = getPowerSync() as unknown as FakePowerSync;
  powersync.clearRows();
  // Generating needs a connection, so a test that exercises it has to say the
  // device has one - the fake is offline by default, like a fresh app.
  powersync.currentStatus.connected = rows.connected ?? false;
  powersync.setRows('FROM profiles', [
    {
      ...makeProfile({ ai_insights_opt_in: rows.optedIn ?? false }),
      ai_insights_opt_in: rows.optedIn ? 1 : 0,
    },
  ]);
  powersync.setRows('AS expense_count', rows.totals ?? []);
  powersync.setRows('AS txn_count', rows.spend ?? []);
  powersync.setRows('FROM categories ', [CATEGORY]);
  powersync.setRows('FROM insights ', rows.insights ?? []);
  return powersync;
}

const SPENDING = {
  totals: [{ income_paise: 9000000, expense_paise: 730000, expense_count: 12 }],
  spend: [{ category_id: 'cat-food', spent_paise: 730000, txn_count: 9 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().reset();
  useAppLockStore.getState().reset();
  useSettingsStore.getState().reset();
  mockSupabase = createFakeSupabase({ session: makeSession(), profile: makeProfile() });
  seed();
});

describe('insights on Home', () => {
  it('shows the on-device insight before anything has been generated', async () => {
    seed(SPENDING);

    await renderRouter('app', { initialUrl: '/' });
    await screen.findByLabelText('Home screen');

    expect(await screen.findByTestId('home-insight-card')).toBeOnTheScreen();
    // The card says where the words came from - it is never left to guess.
    expect(screen.getByLabelText('Worked out on your phone')).toBeOnTheScreen();
    expect(screen.getByText(/Food is your largest category/)).toBeOnTheScreen();
  });

  it('prefers the stored AI insight for the month, and says so', async () => {
    seed({ ...SPENDING, insights: [storedInsight()] });

    await renderRouter('app', { initialUrl: '/' });
    await screen.findByLabelText('Home screen');

    expect(
      await screen.findByText('A steady month so far, with food running ahead of last month.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Written by AI')).toBeOnTheScreen();
  });
});

// Before the generate tests: renderRouter leaves the router on whatever
// route the last test drove it to, and the next mount comes up empty.
describe('consent', () => {
  it('spells out what is sent and what never is', async () => {
    await renderRouter('app', { initialUrl: '/insights/consent' });
    await screen.findByLabelText('AI insights consent screen');

    expect(await screen.findByLabelText('What is sent')).toBeOnTheScreen();
    expect(screen.getByLabelText('What is never sent')).toBeOnTheScreen();
    expect(screen.getByLabelText('Transaction notes. Ever.')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Account names, or anything about where you bank.'),
    ).toBeOnTheScreen();
  });

  it('offers to turn it on, not off, while it is off', async () => {
    await renderRouter('app', { initialUrl: '/insights/consent' });
    await screen.findByLabelText('AI insights consent screen');

    expect(await screen.findByLabelText('Turn on AI insights')).toBeOnTheScreen();
  });
});

describe('the insights screen', () => {
  it('offers the opt-in rather than a generate button when not opted in', async () => {
    seed(SPENDING);

    await renderRouter('app', { initialUrl: '/insights' });
    await screen.findByLabelText('Insights screen');

    expect(await screen.findByText('Want a written read too?')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/Generate an AI insight/)).not.toBeOnTheScreen();
  });

  it('offers to generate once the user has opted in', async () => {
    mockSupabase = createFakeSupabase({
      session: makeSession(),
      profile: makeProfile({ ai_insights_opt_in: true }),
    });
    seed({ ...SPENDING, optedIn: true, connected: true });

    await renderRouter('app', { initialUrl: '/insights' });
    await screen.findByLabelText('Insights screen');

    fireEvent.press(await screen.findByLabelText('Generate an AI insight for this month'));

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('generate-insights', {
        body: { month: MONTH },
      });
    });
  });

  it('will not spend a generation while offline, and says why', async () => {
    seed({ ...SPENDING, optedIn: true, connected: false });

    await renderRouter('app', { initialUrl: '/insights' });
    await screen.findByLabelText('Insights screen');

    const button = await screen.findByLabelText('Generate an insight. Unavailable while offline.');

    expect(button).toBeDisabled();
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
    // The insight below it still works - it was computed here.
    expect(screen.getByLabelText(/Summary\./)).toBeOnTheScreen();
  });

  it('explains a rate limit instead of failing silently', async () => {
    seed({ ...SPENDING, optedIn: true, connected: true });
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        context: { json: async () => ({ error: 'rate_limited' }) },
      },
    });

    await renderRouter('app', { initialUrl: '/insights' });
    await screen.findByLabelText('Insights screen');

    fireEvent.press(await screen.findByLabelText('Generate an AI insight for this month'));

    // Once in the card that stays on screen, once in the toast that does not.
    expect(await screen.findAllByText(/You have used today's generations/)).not.toHaveLength(0);
    expect(screen.getByText('Could not generate')).toBeOnTheScreen();
  });
});
