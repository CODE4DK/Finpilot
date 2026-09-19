import {
  BACKGROUND_LOCK_TIMEOUT_MS,
  shouldHideContent,
  shouldLockOnColdStart,
  shouldLockOnForeground,
} from '@/features/app-lock/lock-policy';
import * as SecureStore from 'expo-secure-store';

import { useAppLockStore } from '@/features/app-lock/app-lock-store';
import { MAX_PIN_ATTEMPTS } from '@/features/app-lock/pin';
import {
  DEFAULT_APP_LOCK_SETTINGS,
  DEFAULT_LOCK_TIMEOUT_MS,
  LOCK_TIMEOUT_OPTIONS,
  narrowTimeout,
} from '@/features/app-lock/storage';

const NOW = 1_800_000_000_000;

describe('shouldLockOnColdStart', () => {
  it('locks when the lock is enabled', () => {
    expect(shouldLockOnColdStart(true)).toBe(true);
    expect(shouldLockOnColdStart(false)).toBe(false);
  });
});

describe('shouldLockOnForeground', () => {
  it('never locks when the feature is off', () => {
    expect(
      shouldLockOnForeground({ enabled: false, backgroundedAt: NOW - 10 * 60_000, now: NOW }),
    ).toBe(false);
  });

  it('locks when there is no recorded background - a cold start', () => {
    expect(shouldLockOnForeground({ enabled: true, backgroundedAt: null, now: NOW })).toBe(true);
  });

  it('does not interrupt a quick task switch', () => {
    expect(shouldLockOnForeground({ enabled: true, backgroundedAt: NOW - 5_000, now: NOW })).toBe(
      false,
    );
  });

  it('locks once the grace period has elapsed', () => {
    expect(
      shouldLockOnForeground({
        enabled: true,
        backgroundedAt: NOW - BACKGROUND_LOCK_TIMEOUT_MS,
        now: NOW,
      }),
    ).toBe(true);
  });

  it('locks on the boundary exactly, and not a millisecond before', () => {
    const justUnder = NOW - BACKGROUND_LOCK_TIMEOUT_MS + 1;
    expect(shouldLockOnForeground({ enabled: true, backgroundedAt: justUnder, now: NOW })).toBe(
      false,
    );
    expect(
      shouldLockOnForeground({
        enabled: true,
        backgroundedAt: NOW - BACKGROUND_LOCK_TIMEOUT_MS - 1,
        now: NOW,
      }),
    ).toBe(true);
  });

  it('honours a custom timeout', () => {
    expect(
      shouldLockOnForeground({
        enabled: true,
        backgroundedAt: NOW - 10_000,
        now: NOW,
        timeoutMs: 5_000,
      }),
    ).toBe(true);
  });

  it('is one minute by default', () => {
    expect(BACKGROUND_LOCK_TIMEOUT_MS).toBe(60_000);
  });
});

describe('shouldHideContent', () => {
  it('covers the screen whenever the app is not active', () => {
    expect(shouldHideContent('inactive', true)).toBe(true);
    expect(shouldHideContent('background', true)).toBe(true);
  });

  it('shows content while the app is active', () => {
    expect(shouldHideContent('active', true)).toBe(false);
  });

  it('does nothing when the lock is off', () => {
    expect(shouldHideContent('background', false)).toBe(false);
    expect(shouldHideContent('inactive', false)).toBe(false);
  });
});

describe('the configurable timeout', () => {
  const settings = { enabled: true, backgroundedAt: 1_000_000 };

  it('locks immediately when the user chose zero', () => {
    expect(shouldLockOnForeground({ ...settings, now: 1_000_001, timeoutMs: 0 })).toBe(true);
  });

  it('waits the chosen fifteen minutes rather than the default minute', () => {
    const fifteen = 15 * 60_000;

    expect(
      shouldLockOnForeground({
        ...settings,
        now: settings.backgroundedAt + 60_000,
        timeoutMs: fifteen,
      }),
    ).toBe(false);
    expect(
      shouldLockOnForeground({
        ...settings,
        now: settings.backgroundedAt + fifteen,
        timeoutMs: fifteen,
      }),
    ).toBe(true);
  });

  it('still ignores the timeout entirely when the lock is off', () => {
    expect(
      shouldLockOnForeground({
        ...settings,
        enabled: false,
        now: Number.MAX_SAFE_INTEGER,
        timeoutMs: 0,
      }),
    ).toBe(false);
  });
});

describe('narrowTimeout', () => {
  it('accepts the values the app offers', () => {
    for (const option of LOCK_TIMEOUT_OPTIONS) {
      expect(narrowTimeout(option.ms)).toBe(option.ms);
    }
  });

  it('refuses a value from nowhere - a corrupt record must not widen the window', () => {
    expect(narrowTimeout(24 * 60 * 60_000)).toBe(DEFAULT_LOCK_TIMEOUT_MS);
    expect(narrowTimeout('forever')).toBe(DEFAULT_LOCK_TIMEOUT_MS);
    expect(narrowTimeout(undefined)).toBe(DEFAULT_LOCK_TIMEOUT_MS);
  });
});

describe('the failed-attempt counter survives a relaunch', () => {
  beforeEach(() => {
    useAppLockStore.getState().reset();
  });

  it('is written to secure storage on every wrong attempt', () => {
    useAppLockStore.getState().registerFailedAttempt();
    useAppLockStore.getState().registerFailedAttempt();

    expect(useAppLockStore.getState().failedAttempts).toBe(2);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'finpilot.app-lock.attempts',
      '2',
      expect.anything(),
    );
  });

  it('is read back on hydrate, so force-quitting buys no fresh guesses', () => {
    useAppLockStore.getState().hydrate({
      settings: DEFAULT_APP_LOCK_SETTINGS,
      hasPin: true,
      biometricsAvailable: false,
      failedAttempts: 4,
    });

    expect(useAppLockStore.getState().failedAttempts).toBe(4);
  });

  it('never hydrates past the maximum, whatever storage says', () => {
    useAppLockStore.getState().hydrate({
      settings: DEFAULT_APP_LOCK_SETTINGS,
      hasPin: true,
      biometricsAvailable: false,
      failedAttempts: 9999,
    });

    expect(useAppLockStore.getState().failedAttempts).toBe(MAX_PIN_ATTEMPTS);
  });

  it('is cleared on a successful unlock', () => {
    useAppLockStore.getState().registerFailedAttempt();
    useAppLockStore.getState().unlock();

    expect(useAppLockStore.getState().failedAttempts).toBe(0);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'finpilot.app-lock.attempts',
      expect.anything(),
    );
  });
});
