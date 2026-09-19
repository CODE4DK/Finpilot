/**
 * Where the router should send someone, given who they are and what state the
 * app is in. Pure on purpose: the guard component in app/_layout.tsx does the
 * navigating, this decides.
 */

export type RouteGroup = 'auth' | 'onboarding' | 'lock' | 'app' | 'unknown';

export interface RouteState {
  /** Null while the stored session is still being read. */
  session: { userId: string } | null;
  /** Null while the profile has not loaded yet. */
  onboardingCompleted: boolean | null;
  /** True when the app lock is armed and not yet satisfied. */
  locked: boolean;
  /** Still restoring session / profile - hold navigation. */
  initialising: boolean;
}

export const ROUTES = {
  welcome: '/(auth)/welcome',
  onboarding: '/(onboarding)/profile',
  lock: '/(lock)/unlock',
  home: '/(tabs)',
} as const;

export type RouteTarget = (typeof ROUTES)[keyof typeof ROUTES];

/** Maps the first Expo Router segment to the group it belongs to. */
export function groupOf(segments: readonly string[]): RouteGroup {
  const first = segments[0];
  switch (first) {
    case '(auth)':
      return 'auth';
    case '(onboarding)':
      return 'onboarding';
    case '(lock)':
      return 'lock';
    case '(tabs)':
    case 'settings':
    case 'dev':
      return 'app';
    default:
      return 'unknown';
  }
}

/**
 * Returns where to redirect, or null to stay put.
 *
 * Order matters: the lock is checked before onboarding, because an unlocked
 * screen must never be reachable by someone holding the device mid-onboarding.
 */
export function resolveRedirect(
  state: RouteState,
  segments: readonly string[],
): RouteTarget | null {
  if (state.initialising) {
    return null;
  }

  const group = groupOf(segments);

  if (!state.session) {
    return group === 'auth' ? null : ROUTES.welcome;
  }

  if (state.locked) {
    return group === 'lock' ? null : ROUTES.lock;
  }

  // Signed in and unlocked - the auth and lock screens have nothing to offer.
  if (state.onboardingCompleted === false) {
    return group === 'onboarding' ? null : ROUTES.onboarding;
  }

  if (state.onboardingCompleted === null) {
    // Profile still loading: don't bounce anyone anywhere yet.
    return null;
  }

  if (group === 'auth' || group === 'lock' || group === 'onboarding') {
    return ROUTES.home;
  }

  return null;
}
