import type { Session, User } from '@supabase/supabase-js';

import type { Profile } from '@/features/auth/api';
import {
  selectOnboardingCompleted,
  selectPendingEmail,
  selectProfile,
  selectStatus,
  selectUserId,
  useAuthStore,
} from '@/features/auth/auth-store';

const ALICE = 'a1111111-1111-4111-8111-111111111111';
const BOB = 'b2222222-2222-4222-8222-222222222222';

function makeSession(userId: string): Session {
  return {
    access_token: 'access',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: userId, email: `${userId}@example.com` } as User,
  } as Session;
}

function makeProfile(userId: string, overrides: Partial<Profile> = {}): Profile {
  return {
    id: userId,
    user_id: userId,
    full_name: 'Alice',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    onboarding_completed: false,
    ai_insights_opt_in: false,
    created_at: '2026-09-19T00:00:00.000Z',
    updated_at: '2026-09-19T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it('starts signed out after a reset', () => {
    expect(selectStatus(useAuthStore.getState())).toBe('signedOut');
    expect(selectUserId(useAuthStore.getState())).toBeNull();
    expect(selectProfile(useAuthStore.getState())).toBeNull();
  });

  it('is initialising before anything has happened', () => {
    // The module default, before the session has been restored.
    expect(useAuthStore.getInitialState().status).toBe('initialising');
  });

  it('records a session and derives the user', () => {
    useAuthStore.getState().setSession(makeSession(ALICE));

    expect(selectStatus(useAuthStore.getState())).toBe('signedIn');
    expect(selectUserId(useAuthStore.getState())).toBe(ALICE);
  });

  it('clears the session on sign out', () => {
    useAuthStore.getState().setSession(makeSession(ALICE));
    useAuthStore.getState().setSession(null);

    expect(selectStatus(useAuthStore.getState())).toBe('signedOut');
    expect(selectUserId(useAuthStore.getState())).toBeNull();
  });

  it('keeps the profile when the same user refreshes their session', () => {
    useAuthStore.getState().setSession(makeSession(ALICE));
    useAuthStore.getState().setProfile(makeProfile(ALICE));
    useAuthStore.getState().setSession(makeSession(ALICE));

    expect(selectProfile(useAuthStore.getState())?.id).toBe(ALICE);
  });

  it('drops the profile when a different user signs in', () => {
    useAuthStore.getState().setSession(makeSession(ALICE));
    useAuthStore.getState().setProfile(makeProfile(ALICE));
    useAuthStore.getState().setSession(makeSession(BOB));

    expect(selectProfile(useAuthStore.getState())).toBeNull();
    expect(selectUserId(useAuthStore.getState())).toBe(BOB);
  });

  it('drops the profile on sign out', () => {
    useAuthStore.getState().setSession(makeSession(ALICE));
    useAuthStore.getState().setProfile(makeProfile(ALICE));
    useAuthStore.getState().setSession(null);

    expect(selectProfile(useAuthStore.getState())).toBeNull();
  });

  it('reports onboarding as unknown until the profile loads', () => {
    useAuthStore.getState().setSession(makeSession(ALICE));
    expect(selectOnboardingCompleted(useAuthStore.getState())).toBeNull();

    useAuthStore.getState().setProfile(makeProfile(ALICE));
    expect(selectOnboardingCompleted(useAuthStore.getState())).toBe(false);

    useAuthStore.getState().setProfile(makeProfile(ALICE, { onboarding_completed: true }));
    expect(selectOnboardingCompleted(useAuthStore.getState())).toBe(true);
  });

  it('marks onboarding complete without a round trip', () => {
    useAuthStore.getState().setSession(makeSession(ALICE));
    useAuthStore.getState().setProfile(makeProfile(ALICE));
    useAuthStore.getState().markOnboardingCompleted();

    expect(selectOnboardingCompleted(useAuthStore.getState())).toBe(true);
  });

  it('ignores markOnboardingCompleted when there is no profile', () => {
    useAuthStore.getState().markOnboardingCompleted();
    expect(selectProfile(useAuthStore.getState())).toBeNull();
  });

  it('carries the pending email between the email and verify screens', () => {
    useAuthStore.getState().setPendingEmail('alice@example.com');
    expect(selectPendingEmail(useAuthStore.getState())).toBe('alice@example.com');

    useAuthStore.getState().reset();
    expect(selectPendingEmail(useAuthStore.getState())).toBeNull();
  });

  it('tracks in-flight requests', () => {
    useAuthStore.getState().setBusy(true);
    expect(useAuthStore.getState().busy).toBe(true);
    useAuthStore.getState().setBusy(false);
    expect(useAuthStore.getState().busy).toBe(false);
  });
});
