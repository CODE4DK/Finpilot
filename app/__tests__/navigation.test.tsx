import { renderRouter, screen } from 'expo-router/testing-library';

import { useAppLockStore } from '@/features/app-lock/app-lock-store';
import { useAuthStore } from '@/features/auth/auth-store';
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

/**
 * Smoke tests for the navigation shell and the route guard: the right group
 * renders for each auth state, and every route still mounts.
 */
describe('navigation shell', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    useAppLockStore.getState().reset();
    // A signed-in, onboarded, unlocked user unless a test says otherwise.
    mockSupabase = createFakeSupabase({ session: makeSession(), profile: makeProfile() });
  });

  it('renders the home tab at / for a signed-in user', async () => {
    await renderRouter('app', { initialUrl: '/' });

    expect(await screen.findByLabelText('Home screen')).toBeOnTheScreen();
  });

  it('exposes every tab, with the centre Add button', async () => {
    await renderRouter('app', { initialUrl: '/' });

    await screen.findByLabelText('Home screen');
    expect(screen.getByLabelText('Transactions tab')).toBeOnTheScreen();
    expect(screen.getByLabelText('Budgets tab')).toBeOnTheScreen();
    expect(screen.getByLabelText('Reports tab')).toBeOnTheScreen();
    expect(screen.getByLabelText('Add a transaction')).toBeOnTheScreen();
  });

  it.each([
    ['/transactions', 'Transactions screen'],
    ['/add', 'Add transaction screen'],
    ['/budgets', 'Budgets screen'],
    ['/reports', 'Reports screen'],
  ])('renders %s', async (url, label) => {
    await renderRouter('app', { initialUrl: url });
    expect(await screen.findByLabelText(label)).toBeOnTheScreen();
  });

  it.each([
    ['/settings', 'Settings screen'],
    ['/settings/appearance', 'Appearance settings screen'],
    ['/settings/security', 'Security settings screen'],
    ['/settings/about', 'About screen'],
  ])('renders %s', async (url, label) => {
    await renderRouter('app', { initialUrl: url });
    expect(await screen.findByLabelText(label)).toBeOnTheScreen();
  });

  it('renders the dev component gallery in development builds', async () => {
    await renderRouter('app', { initialUrl: '/dev/components' });
    expect(await screen.findByLabelText('Component gallery screen')).toBeOnTheScreen();
  });
});

describe('route guard', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    useAppLockStore.getState().reset();
  });

  it('sends a signed-out visitor to the welcome screen', async () => {
    mockSupabase = createFakeSupabase({ session: null, profile: null });

    await renderRouter('app', { initialUrl: '/' });

    expect(await screen.findByLabelText('Welcome screen')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Home screen')).not.toBeOnTheScreen();
  });

  it('keeps a signed-out visitor inside the auth group', async () => {
    mockSupabase = createFakeSupabase({ session: null, profile: null });

    await renderRouter('app', { initialUrl: '/(auth)/email' });

    expect(await screen.findByLabelText('Email sign in screen')).toBeOnTheScreen();
  });

  it('sends a signed-in visitor away from the auth group', async () => {
    mockSupabase = createFakeSupabase({ session: makeSession(), profile: makeProfile() });

    await renderRouter('app', { initialUrl: '/(auth)/welcome' });

    expect(await screen.findByLabelText('Home screen')).toBeOnTheScreen();
  });

  it('sends a user who has not finished onboarding to the wizard', async () => {
    mockSupabase = createFakeSupabase({
      session: makeSession(),
      profile: makeProfile({ onboarding_completed: false }),
    });

    await renderRouter('app', { initialUrl: '/' });

    expect(await screen.findByLabelText('Onboarding, your details')).toBeOnTheScreen();
  });

  it('sends a locked user to the unlock screen', async () => {
    mockSupabase = createFakeSupabase({ session: makeSession(), profile: makeProfile() });

    await renderRouter('app', { initialUrl: '/' });
    await screen.findByLabelText('Home screen');

    useAppLockStore.getState().lock();

    expect(await screen.findByLabelText('Unlock screen')).toBeOnTheScreen();
  });

  it('returns a user to the app once they unlock', async () => {
    mockSupabase = createFakeSupabase({ session: makeSession(), profile: makeProfile() });

    await renderRouter('app', { initialUrl: '/' });
    await screen.findByLabelText('Home screen');

    useAppLockStore.getState().lock();
    await screen.findByLabelText('Unlock screen');

    useAppLockStore.getState().unlock();

    expect(await screen.findByLabelText('Home screen')).toBeOnTheScreen();
  });
});
