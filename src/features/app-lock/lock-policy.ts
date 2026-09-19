/**
 * When the app should re-lock. Pure so the rule is testable without an
 * AppState or a clock.
 */

/** Grace period before a backgrounded app demands the lock again. */
export const BACKGROUND_LOCK_TIMEOUT_MS = 60_000;

export interface LockDecisionInput {
  enabled: boolean;
  /** When the app last went to the background, or null if it has not. */
  backgroundedAt: number | null;
  now: number;
  timeoutMs?: number;
}

/**
 * A cold start always locks (there is no backgroundedAt to compare), and a
 * return from the background locks once the grace period has elapsed. Coming
 * back inside the grace period does not interrupt the user.
 */
export function shouldLockOnForeground({
  enabled,
  backgroundedAt,
  now,
  timeoutMs = BACKGROUND_LOCK_TIMEOUT_MS,
}: LockDecisionInput): boolean {
  if (!enabled) {
    return false;
  }
  if (backgroundedAt === null) {
    return true;
  }
  return now - backgroundedAt >= timeoutMs;
}

/** Cold start: locked from the first frame whenever the lock is enabled. */
export function shouldLockOnColdStart(enabled: boolean): boolean {
  return enabled;
}

/**
 * The app switcher shows a snapshot of the last frame, so content must be
 * covered while the app is not active - including the brief 'inactive' state
 * iOS reports when the switcher opens or a system sheet appears.
 */
export function shouldHideContent(appState: string, lockEnabled: boolean): boolean {
  return lockEnabled && appState !== 'active';
}
