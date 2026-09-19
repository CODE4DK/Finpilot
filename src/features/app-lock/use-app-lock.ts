import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { useAppLockStore } from './app-lock-store';
import { getBiometricCapability } from './biometrics';
import { shouldHideContent, shouldLockOnForeground } from './lock-policy';
import { readAppLockSettings, readFailedAttempts, readPinRecord } from './storage';

/**
 * Wires the lock to the app lifecycle:
 *   * hydrate from secure storage on mount (a cold start locks immediately),
 *   * record when the app leaves the foreground,
 *   * re-lock on return once the grace period has passed.
 */
export function useAppLockLifecycle() {
  const hydrate = useAppLockStore((state) => state.hydrate);
  const lock = useAppLockStore((state) => state.lock);
  const setBackgroundedAt = useAppLockStore((state) => state.setBackgroundedAt);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) {
      return;
    }
    hydrated.current = true;

    void (async () => {
      const [settings, pinRecord, capability, failedAttempts] = await Promise.all([
        readAppLockSettings(),
        readPinRecord(),
        getBiometricCapability(),
        readFailedAttempts(),
      ]);
      hydrate({
        settings,
        hasPin: pinRecord !== null,
        biometricsAvailable: capability.available,
        failedAttempts,
      });
    })();
  }, [hydrate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      const { settings, backgroundedAt } = useAppLockStore.getState();

      if (next === 'background') {
        setBackgroundedAt(Date.now());
        return;
      }

      if (next === 'active') {
        if (
          shouldLockOnForeground({
            enabled: settings.enabled,
            backgroundedAt,
            now: Date.now(),
            timeoutMs: settings.timeoutMs,
          })
        ) {
          lock();
        }
        setBackgroundedAt(null);
      }
    });

    return () => subscription.remove();
  }, [lock, setBackgroundedAt]);
}

/**
 * Android draws the recents thumbnail from the live window, so FLAG_SECURE -
 * which expo-screen-capture sets - is what actually blanks it there. iOS
 * snapshots the last frame instead, which the privacy cover handles.
 */
export function useSecureFlagWhileLocked(): void {
  const lockEnabled = useAppLockStore((state) => state.settings.enabled);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (lockEnabled) {
      void ScreenCapture.preventScreenCaptureAsync('app-lock');
    } else {
      void ScreenCapture.allowScreenCaptureAsync('app-lock');
    }
  }, [lockEnabled]);
}

/**
 * Whether to draw the privacy cover. The app switcher screenshots the last
 * frame, so content must be covered while the app is not active - including
 * the brief 'inactive' state iOS reports as the switcher opens.
 */
export function useHideContentWhenInactive(): boolean {
  const lockEnabled = useAppLockStore((state) => state.settings.enabled);
  const [appState, setAppState] = useState<AppStateStatus>(() => AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  return shouldHideContent(appState, lockEnabled);
}

/** Convenience for screens that need to arm or disarm the lock. */
export function useLockActions() {
  const lockStore = useAppLockStore;

  const lockNow = useCallback(() => lockStore.getState().lock(), [lockStore]);
  const unlockNow = useCallback(() => lockStore.getState().unlock(), [lockStore]);

  return { lockNow, unlockNow };
}
