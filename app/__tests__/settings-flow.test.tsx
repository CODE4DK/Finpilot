import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { getPowerSync } from '@/db/powersync';
import { useAppLockStore } from '@/features/app-lock/app-lock-store';
import { useAuthStore } from '@/features/auth/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { FakePowerSync } from '@/test-utils/fake-powersync';
import {
  createFakeSupabase,
  makeProfile,
  makeSession,
  type FakeSupabase,
} from '@/test-utils/supabase-mock';

// `mock`-prefixed so jest allows the factory below to close over it.
let mockSupabase: FakeSupabase;

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
  startSupabaseAutoRefresh: () => () => {},
}));

describe('settings flows', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
    useAuthStore.getState().reset();
    useAppLockStore.getState().reset();
    mockSupabase = createFakeSupabase({ session: makeSession(), profile: makeProfile() });

    // The home screen reads its numbers from the local database now, so the
    // balance under test has to come from there.
    const powersync = getPowerSync() as unknown as FakePowerSync;
    powersync.clearRows();
    powersync.setRows('FROM accounts a', [
      {
        id: 'acc-1',
        user_id: 'user-1',
        name: 'HDFC',
        type: 'bank',
        opening_balance_paise: 12456700,
        balance_paise: 12456700,
        is_archived: 0,
        color: null,
        icon: null,
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-09-01T00:00:00.000Z',
        deleted_at: null,
      },
    ]);
  });

  it('switches the theme from the appearance screen', async () => {
    await renderRouter('app', { initialUrl: '/settings/appearance' });
    await screen.findByLabelText('Appearance settings screen');

    await fireEvent.press(screen.getByLabelText('Dark theme'));
    expect(useSettingsStore.getState().themePreference).toBe('dark');

    await fireEvent.press(screen.getByLabelText('Follow system theme'));
    expect(useSettingsStore.getState().themePreference).toBe('system');
  });

  it('toggles privacy mode from the home header and hides the balance', async () => {
    await renderRouter('app', { initialUrl: '/' });
    await screen.findByLabelText('Home screen');

    expect(screen.getByLabelText('₹1,24,567.00')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Hide amounts'));
    expect(useSettingsStore.getState().privacyMode).toBe(true);
    expect(screen.getByLabelText('Balance hidden by privacy mode')).toBeOnTheScreen();
    expect(screen.queryByLabelText('₹1,24,567.00')).not.toBeOnTheScreen();
  });

  it('toggles privacy mode from the settings switch', async () => {
    await renderRouter('app', { initialUrl: '/settings' });
    await screen.findByLabelText('Settings screen');

    await fireEvent(screen.getByLabelText('Toggle privacy mode'), 'valueChange', true);
    expect(useSettingsStore.getState().privacyMode).toBe(true);
  });

  it('shows who is signed in', async () => {
    await renderRouter('app', { initialUrl: '/settings' });
    await screen.findByLabelText('Settings screen');

    expect(screen.getByText('alice@example.com')).toBeOnTheScreen();
  });

  it('signs out and lands back on the welcome screen', async () => {
    await renderRouter('app', { initialUrl: '/settings' });
    await screen.findByLabelText('Settings screen');

    await fireEvent.press(screen.getByLabelText('Sign out of FinPilot'));

    expect(await screen.findByLabelText('Welcome screen')).toBeOnTheScreen();
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });
});
