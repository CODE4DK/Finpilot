import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
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

function seed(optedIn = false) {
  const powersync = getPowerSync() as unknown as FakePowerSync;
  powersync.clearRows();
  powersync.setRows('FROM profiles', [
    { ...makeProfile({ ai_insights_opt_in: optedIn }), ai_insights_opt_in: optedIn ? 1 : 0 },
  ]);
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

describe('the profile screen', () => {
  it('shows the signed-in email, which is not editable', async () => {
    await renderRouter('app', { initialUrl: '/settings/profile' });
    await screen.findByLabelText('Profile settings screen');

    expect(screen.getByLabelText(/Signed in as .*@/)).toBeOnTheScreen();
  });

  it('will not save until something actually changed', async () => {
    await renderRouter('app', { initialUrl: '/settings/profile' });
    await screen.findByLabelText('Profile settings screen');

    expect(screen.getByLabelText('Save your profile. Nothing has changed.')).toBeDisabled();
  });

  it('refuses a name the database would refuse', async () => {
    await renderRouter('app', { initialUrl: '/settings/profile' });
    await screen.findByLabelText('Profile settings screen');

    await fireEvent.changeText(screen.getByLabelText('Your name'), 'a'.repeat(121));

    expect(await screen.findByText(/Keep the name under 120/)).toBeOnTheScreen();
  });
});

// Ahead of the screens that navigate: renderRouter leaves the router on
// whatever route a test drove it to, and the next mount comes up empty.
describe('the security screen', () => {
  it('offers a lock timeout once the lock is on', async () => {
    await renderRouter('app', { initialUrl: '/settings/security' });
    await screen.findByLabelText('Security settings screen');

    // Turning the lock on is what reveals the timeout row; hydrating before
    // the render would send the router to the unlock screen instead, because
    // a cold start with the lock on always locks.
    await act(async () => {
      useAppLockStore.getState().setSettings({
        enabled: true,
        biometricsEnabled: false,
        timeoutMs: 60_000,
      });
    });

    expect(await screen.findByLabelText('Lock after after 1 minute')).toBeOnTheScreen();
  });
});

describe('exporting data', () => {
  it('writes every table and opens the share sheet', async () => {
    const powersync = seed();
    powersync.getAll.mockResolvedValue([{ id: 'row-1', user_id: TEST_USER_ID }]);

    await renderRouter('app', { initialUrl: '/settings/data' });
    await screen.findByLabelText('Data settings screen');

    await fireEvent.press(screen.getByLabelText('Export all of your FinPilot data as a file'));

    await waitFor(() => {
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringMatching(/finpilot-export-.*\.json$/),
        expect.objectContaining({ mimeType: 'application/json' }),
      );
    });
    // One read per exported table, soft-deleted rows included. Other parts of
    // the app read too, so assert on which tables were asked for rather than
    // on a call count.
    const queried = powersync.getAll.mock.calls
      .map(([sql]) => /FROM (\w+) WHERE user_id/.exec(String(sql))?.[1])
      .filter(Boolean);

    expect(new Set(queried)).toEqual(
      new Set([
        'profiles',
        'accounts',
        'categories',
        'recurring_rules',
        'transactions',
        'budgets',
        'goals',
        'goal_contributions',
        'insights',
      ]),
    );
  });

  it('offers the delete route from the same screen', async () => {
    await renderRouter('app', { initialUrl: '/settings/data' });
    await screen.findByLabelText('Data settings screen');

    expect(screen.getByLabelText('Delete your account')).toBeOnTheScreen();
  });
});

describe('deleting an account', () => {
  it('keeps the button disabled until the word is typed', async () => {
    await renderRouter('app', { initialUrl: '/settings/delete-account' });
    await screen.findByLabelText('Delete account screen');

    expect(screen.getByLabelText('Delete my account. Type DELETE above first.')).toBeDisabled();
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('calls the edge function once the user means it', async () => {
    await renderRouter('app', { initialUrl: '/settings/delete-account' });
    await screen.findByLabelText('Delete account screen');

    await fireEvent.changeText(
      screen.getByLabelText('Type DELETE to confirm deleting your account'),
      'DELETE',
    );
    await fireEvent.press(await screen.findByLabelText('Delete my account permanently'));

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('delete-account', {
        body: { confirm: 'DELETE' },
      });
    });
  });

  it('says nothing was removed when the call fails', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsHttpError', context: { status: 500 } },
    });

    await renderRouter('app', { initialUrl: '/settings/delete-account' });
    await screen.findByLabelText('Delete account screen');

    await fireEvent.changeText(
      screen.getByLabelText('Type DELETE to confirm deleting your account'),
      'delete',
    );
    await fireEvent.press(await screen.findByLabelText('Delete my account permanently'));

    expect(await screen.findByText(/Nothing has been removed/)).toBeOnTheScreen();
  });

  it('tells the user to come back online rather than half-deleting', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsFetchError' },
    });

    await renderRouter('app', { initialUrl: '/settings/delete-account' });
    await screen.findByLabelText('Delete account screen');

    await fireEvent.changeText(
      screen.getByLabelText('Type DELETE to confirm deleting your account'),
      'DELETE',
    );
    await fireEvent.press(await screen.findByLabelText('Delete my account permanently'));

    expect(await screen.findByText(/needs a connection/)).toBeOnTheScreen();
  });
});
