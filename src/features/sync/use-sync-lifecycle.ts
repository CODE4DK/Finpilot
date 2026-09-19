import { useEffect } from 'react';

import { connectPowerSync, disconnectPowerSync } from '@/db/powersync';
import { useAuthStore } from '@/features/auth/auth-store';

import { logWarn } from '@/lib/logger';

/**
 * Connects PowerSync once a user is signed in, and disconnects when they are
 * not. The local database is only cleared on an explicit sign-out - see
 * `signOutEverywhere` - because losing local rows on a transient token blip
 * would throw away offline work.
 */
export function useSyncLifecycle() {
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  useEffect(() => {
    if (status !== 'signedIn' || !userId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await connectPowerSync();
      } catch (error) {
        if (!cancelled) {
          // Connecting is retried by PowerSync itself; surfacing the state is
          // the indicator's job, so this only needs to not crash the tree.
          logWarn('powersync', 'connect failed', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      void disconnectPowerSync();
    };
  }, [status, userId]);
}
