import type { Session, User } from '@supabase/supabase-js';

import type { Profile } from '@/features/auth/api';

export const TEST_USER_ID = 'a1111111-1111-4111-8111-111111111111';

export function makeSession(userId: string = TEST_USER_ID, email = 'alice@example.com'): Session {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: userId, email } as User,
  } as Session;
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: TEST_USER_ID,
    user_id: TEST_USER_ID,
    full_name: 'Alice',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    onboarding_completed: true,
    ai_insights_opt_in: false,
    created_at: '2026-09-19T00:00:00.000Z',
    updated_at: '2026-09-19T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

export interface FakeSupabaseOptions {
  session?: Session | null;
  profile?: Profile | null;
}

/**
 * Just enough of the supabase-js surface for the auth gate: reading the stored
 * session, subscribing to changes, fetching the profile and signing out.
 */
export function createFakeSupabase(options: FakeSupabaseOptions = {}) {
  let session = options.session ?? null;
  const profile = options.profile ?? null;
  const listeners = new Set<(event: string, session: Session | null) => void>();

  const query = {
    select: () => query,
    eq: () => query,
    is: () => query,
    maybeSingle: async () => ({ data: profile, error: null }),
    single: async () => ({ data: profile, error: null }),
    update: () => query,
    insert: async () => ({ data: null, error: null }),
  };

  return {
    auth: {
      getSession: jest.fn(async () => ({ data: { session }, error: null })),
      onAuthStateChange: jest.fn((callback: (event: string, session: Session | null) => void) => {
        listeners.add(callback);
        return {
          data: { subscription: { unsubscribe: () => listeners.delete(callback) } },
        };
      }),
      signOut: jest.fn(async () => {
        session = null;
        listeners.forEach((listener) => listener('SIGNED_OUT', null));
        return { error: null };
      }),
      signInWithOtp: jest.fn(async () => ({ data: {}, error: null })),
      verifyOtp: jest.fn(async () => ({ data: { session }, error: null })),
      signInWithIdToken: jest.fn(async () => ({ data: { session }, error: null })),
      startAutoRefresh: jest.fn(async () => {}),
      stopAutoRefresh: jest.fn(async () => {}),
    },
    from: jest.fn(() => query),
    /** Push a session change the way supabase-js would. */
    __emit(next: Session | null) {
      session = next;
      listeners.forEach((listener) => listener(next ? 'SIGNED_IN' : 'SIGNED_OUT', next));
    },
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
