import { useRouter, useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';

import { useAppLockStore } from '@/features/app-lock/app-lock-store';
import { PrivacyCover } from '@/features/app-lock/privacy-cover';
import {
  useAppLockLifecycle,
  useHideContentWhenInactive,
  useSecureFlagWhileLocked,
} from '@/features/app-lock/use-app-lock';

import { useAuthStore } from './auth-store';
import { resolveRedirect, type RouteState } from './routing';
import { useAuthBootstrap, useProfileSync } from './use-auth';

/**
 * The single place navigation is enforced. It restores the session, loads the
 * profile, runs the app-lock lifecycle, and redirects according to
 * `resolveRedirect` - which is pure and unit tested in routing.test.ts.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  useAuthBootstrap();
  useProfileSync();
  useAppLockLifecycle();
  useSecureFlagWhileLocked();

  const router = useRouter();
  const segments = useSegments();
  const hideContent = useHideContentWhenInactive();

  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const profile = useAuthStore((state) => state.profile);
  const locked = useAppLockStore((state) => state.locked);
  const lockReady = useAppLockStore((state) => state.ready);

  const state: RouteState = {
    session: userId ? { userId } : null,
    onboardingCompleted: profile ? profile.onboarding_completed : null,
    locked,
    // Hold navigation until both the session and the lock settings are known,
    // otherwise a locked app would flash its contents on launch.
    initialising: status === 'initialising' || !lockReady,
  };

  useEffect(() => {
    const target = resolveRedirect(state, segments as string[]);
    if (target) {
      router.replace(target);
    }
    // `state` is derived from the values in this dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    router,
    segments,
    state.session?.userId,
    state.onboardingCompleted,
    state.locked,
    state.initialising,
  ]);

  return (
    <>
      {children}
      {hideContent ? <PrivacyCover /> : null}
    </>
  );
}
