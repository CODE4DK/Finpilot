import {
  BACKGROUND_LOCK_TIMEOUT_MS,
  shouldHideContent,
  shouldLockOnColdStart,
  shouldLockOnForeground,
} from '@/features/app-lock/lock-policy';

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
