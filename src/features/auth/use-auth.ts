import { useEffect, useRef } from 'react';

import { disconnectAndClearPowerSync, resetPowerSyncInstance } from '@/db/powersync';
import { useAppLockStore } from '@/features/app-lock/app-lock-store';
import { clearAppLockStorage } from '@/features/app-lock/storage';
import { getSupabaseClient, startSupabaseAutoRefresh } from '@/lib/supabase';
import { useSettingsStore } from '@/stores/settings-store';

import { fetchProfile, signOut as signOutRequest } from './api';
import { useAuthStore } from './auth-store';

/**
 * Restores the stored session on launch and keeps the auth store in step with
 * supabase-js. Mounted once, from the root layout.
 */
export function useAuthBootstrap() {
  const setSession = useAuthStore((state) => state.setSession);
  const setProfile = useAuthStore((state) => state.setProfile);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    const supabase = getSupabaseClient();

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const stopAutoRefresh = startSupabaseAutoRefresh(supabase);

    return () => {
      subscription.subscription.unsubscribe();
      stopAutoRefresh();
    };
  }, [setProfile, setSession]);
}

/**
 * Loads the profile whenever a user signs in. The route guard waits on this:
 * onboarding is decided by profiles.onboarding_completed, so guessing before
 * it arrives would bounce people to the wrong screen.
 */
export function useProfileSync() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const profileId = useAuthStore((state) => state.profile?.id ?? null);
  const setProfile = useAuthStore((state) => state.setProfile);

  useEffect(() => {
    if (!userId || profileId === userId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const profile = await fetchProfile(userId);
        if (!cancelled) {
          setProfile(profile);
        }
      } catch (error) {
        // Offline or a transient failure: leave the profile null so the guard
        // holds position rather than sending the user through onboarding again.
        console.warn('Could not load profile', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId, setProfile, userId]);
}

/**
 * Signs out and wipes everything this device held for the user: the local
 * PowerSync database, the Supabase session (removed from secure storage by
 * supabase-js), the app-lock PIN and settings, and the in-memory stores.
 */
export async function signOutEverywhere(): Promise<void> {
  try {
    // Stop syncing and drop the local rows first: they are another person's
    // finances if this device is shared, and a half-signed-out app must not
    // keep serving them.
    await disconnectAndClearPowerSync();
  } catch (error) {
    console.warn('[powersync] could not clear the local database', error);
  }

  try {
    await signOutRequest();
  } finally {
    // Even if the network call fails, the device must forget the user.
    resetPowerSyncInstance();
    await clearAppLockStorage();
    useAppLockStore.getState().reset();
    useSettingsStore.getState().reset();
    useAuthStore.getState().reset();
  }
}
