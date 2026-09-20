import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { Profile } from './api';

import { identifyUser } from '@/lib/monitoring';

export type AuthStatus = 'initialising' | 'signedOut' | 'signedIn';

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Set while a sign-in request is in flight. */
  busy: boolean;
  /** The email an OTP was last sent to, carried to the verify screen. */
  pendingEmail: string | null;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setBusy: (busy: boolean) => void;
  setPendingEmail: (email: string | null) => void;
  markOnboardingCompleted: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  status: 'initialising',
  session: null,
  user: null,
  profile: null,
  busy: false,
  pendingEmail: null,
} satisfies Omit<
  AuthState,
  'setSession' | 'setProfile' | 'setBusy' | 'setPendingEmail' | 'markOnboardingCompleted' | 'reset'
>;

export const useAuthStore = create<AuthState>((set) => ({
  ...INITIAL_STATE,

  setSession: (session) => {
    // Reports are tied to the user by id alone - enough to count who is
    // affected, and not their identity. See src/lib/monitoring.ts.
    identifyUser(session?.user.id ?? null);

    set((state) => ({
      session,
      user: session?.user ?? null,
      status: session ? 'signedIn' : 'signedOut',
      // A different user - or none - must never inherit the previous profile.
      profile: session && state.profile?.id === session.user.id ? state.profile : null,
    }));
  },

  setProfile: (profile) => set({ profile }),
  setBusy: (busy) => set({ busy }),
  setPendingEmail: (pendingEmail) => set({ pendingEmail }),

  markOnboardingCompleted: () =>
    set((state) =>
      state.profile ? { profile: { ...state.profile, onboarding_completed: true } } : {},
    ),

  reset: () => {
    identifyUser(null);
    set({ ...INITIAL_STATE, status: 'signedOut' });
  },
}));

/* Selectors - keep components from re-rendering on unrelated changes. */
export const selectStatus = (state: AuthState) => state.status;
export const selectSession = (state: AuthState) => state.session;
export const selectUserId = (state: AuthState) => state.user?.id ?? null;
export const selectProfile = (state: AuthState) => state.profile;
export const selectBusy = (state: AuthState) => state.busy;
export const selectPendingEmail = (state: AuthState) => state.pendingEmail;

/**
 * Null while the profile has not loaded, which the route guard treats as
 * "don't move yet" rather than "onboarding incomplete".
 */
export const selectOnboardingCompleted = (state: AuthState): boolean | null =>
  state.profile ? state.profile.onboarding_completed : null;
