import * as Notifications from 'expo-notifications';
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

function budgetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'budget-1',
    user_id: TEST_USER_ID,
    category_id: CATEGORY.id,
    month: '2026-09-01',
    limit_paise: 1000000,
    spent_paise: 850000,
    alert_80_sent: 0,
    alert_100_sent: 0,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function goalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'goal-1',
    user_id: TEST_USER_ID,
    name: 'Emergency fund',
    target_paise: 50000000,
    target_date: '2027-09-01',
    icon: 'umbrella-outline',
    status: 'active',
    saved_paise: 10000000,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function seed(rows: { budgets?: unknown[]; goals?: unknown[] } = {}) {
  const powersync = getPowerSync() as unknown as FakePowerSync;
  powersync.clearRows();
  powersync.setRows('FROM categories ', [CATEGORY]);
  powersync.setRows('FROM budgets b', rows.budgets ?? []);
  powersync.setRows('FROM budgets ', rows.budgets ?? []);
  powersync.setRows('FROM goals g', rows.goals ?? []);
  powersync.setRows('FROM goals ', rows.goals ?? []);
  return powersync;
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().reset();
  useAppLockStore.getState().reset();
  useSettingsStore.getState().reset();
  mockSupabase = createFakeSupabase({ session: makeSession(), profile: makeProfile() });
  seed();
});

describe('the budgets tab', () => {
  it('offers to set a budget when the month is empty', async () => {
    await renderRouter('app', { initialUrl: '/budgets' });
    await screen.findByLabelText('Budgets screen');

    expect(await screen.findByText('No budgets for this month')).toBeOnTheScreen();
  });

  it('shows spent against limit with days left and a daily allowance', async () => {
    seed({ budgets: [budgetRow()] });

    await renderRouter('app', { initialUrl: '/budgets' });
    await screen.findByLabelText('Budgets screen');

    expect(await screen.findByText('Days left')).toBeOnTheScreen();
    expect(screen.getByText('Safe per day')).toBeOnTheScreen();
    expect(screen.getByLabelText(/Safe to spend .* per day/)).toBeOnTheScreen();
  });

  it('labels a budget with the percentage used, not colour alone', async () => {
    seed({ budgets: [budgetRow()] });

    await renderRouter('app', { initialUrl: '/budgets' });
    await screen.findByLabelText('Budgets screen');

    // 85% - in the amber band, and stated in words for anyone who cannot
    // distinguish the colour.
    expect(await screen.findByLabelText(/Food budget, 85% used/)).toBeOnTheScreen();
  });

  it('says how many budgets are over', async () => {
    seed({ budgets: [budgetRow({ spent_paise: 1400000 })] });

    await renderRouter('app', { initialUrl: '/budgets' });
    await screen.findByLabelText('Budgets screen');

    expect(await screen.findByText('1 budget is over')).toBeOnTheScreen();
  });

  it('opens the budget form', async () => {
    await renderRouter('app', { initialUrl: '/budgets/new' });

    expect(await screen.findByLabelText('New budget screen')).toBeOnTheScreen();
  });
});

describe('budget alerts', () => {
  it('stays silent while alerts are switched off', async () => {
    seed({ budgets: [budgetRow()] });

    await renderRouter('app', { initialUrl: '/budgets' });
    await screen.findByLabelText('Budgets screen');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('fires once when a budget crosses 80%, and marks the flag', async () => {
    useSettingsStore.getState().setBudgetAlertsEnabled(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });
    const powersync = seed({ budgets: [budgetRow()] });

    await renderRouter('app', { initialUrl: '/budgets' });
    await screen.findByLabelText('Budgets screen');

    await waitFor(() => {
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    });

    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(call.content.title).toContain('85%');

    // The flag is written only after delivery, so a failed send does not burn
    // the one alert this budget gets.
    await waitFor(() => {
      const update = powersync.execute.mock.calls.find(([sql]) =>
        String(sql).startsWith('UPDATE budgets SET alert_80_sent'),
      );
      expect(update).toBeDefined();
    });
  });

  it('says nothing about a budget whose alert was already sent', async () => {
    useSettingsStore.getState().setBudgetAlertsEnabled(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });
    seed({ budgets: [budgetRow({ alert_80_sent: 1 })] });

    await renderRouter('app', { initialUrl: '/budgets' });
    await screen.findByLabelText('Budgets screen');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('announces only the 100% crossing when a budget jumps past both', async () => {
    useSettingsStore.getState().setBudgetAlertsEnabled(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
    });
    seed({ budgets: [budgetRow({ spent_paise: 1300000 })] });

    await renderRouter('app', { initialUrl: '/budgets' });
    await screen.findByLabelText('Budgets screen');

    await waitFor(() => {
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    });
    expect(
      (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0].content.title,
    ).toContain('used up');
  });

  it('does not ask for notification permission at launch', async () => {
    await renderRouter('app', { initialUrl: '/' });
    await screen.findByLabelText('Home screen');

    // The one prompt iOS gives us is spent when the user turns alerts on,
    // not on a screen they did not ask for.
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks for permission when the user turns alerts on', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
      canAskAgain: true,
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    await renderRouter('app', { initialUrl: '/settings/notifications' });
    await screen.findByLabelText('Notification settings screen');

    await fireEvent(screen.getByLabelText('Toggle budget alerts'), 'valueChange', true);

    expect(await screen.findByText('Budget alerts are on')).toBeOnTheScreen();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().budgetAlertsEnabled).toBe(true);
  });

  it('leaves alerts off and explains when permission is refused', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
      canAskAgain: false,
    });

    await renderRouter('app', { initialUrl: '/settings/notifications' });
    await screen.findByLabelText('Notification settings screen');

    await fireEvent(screen.getByLabelText('Toggle budget alerts'), 'valueChange', true);

    expect(await screen.findAllByText(/phone settings/)).not.toHaveLength(0);
    expect(useSettingsStore.getState().budgetAlertsEnabled).toBe(false);
  });
});

describe('goals', () => {
  it('invites a first goal when there are none', async () => {
    await renderRouter('app', { initialUrl: '/goals' });

    expect(await screen.findByText('No goals yet')).toBeOnTheScreen();
  });

  it('lists a goal with its progress', async () => {
    seed({ goals: [goalRow()] });

    await renderRouter('app', { initialUrl: '/goals' });
    await screen.findByLabelText('Goals screen');

    expect(await screen.findByLabelText(/Emergency fund, 20% saved/)).toBeOnTheScreen();
  });

  it('marks a funded goal as reached', async () => {
    seed({ goals: [goalRow({ saved_paise: 50000000 })] });

    await renderRouter('app', { initialUrl: '/goals' });
    await screen.findByLabelText('Goals screen');

    expect(await screen.findByText('Reached')).toBeOnTheScreen();
  });

  it('opens the new-goal form', async () => {
    await renderRouter('app', { initialUrl: '/goals/new' });

    expect(await screen.findByLabelText('New goal screen')).toBeOnTheScreen();
  });

  it('shows the required monthly saving on a goal with a date', async () => {
    seed({ goals: [goalRow()] });

    await renderRouter('app', { initialUrl: '/goals/goal-1' });
    await screen.findByLabelText('Goal detail screen');

    expect(await screen.findByText('Save each month')).toBeOnTheScreen();
  });

  it('is honest about having no pace to project from', async () => {
    seed({ goals: [goalRow({ saved_paise: 0 })] });

    await renderRouter('app', { initialUrl: '/goals/goal-1' });
    await screen.findByLabelText('Goal detail screen');

    expect(await screen.findByText('Add a contribution to see your pace')).toBeOnTheScreen();
  });
});
