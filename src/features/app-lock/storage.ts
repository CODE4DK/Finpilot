import * as SecureStore from 'expo-secure-store';

import type { PinRecord } from './pin';

/**
 * The PIN record and the lock preferences live in the keychain/keystore, not
 * in AsyncStorage, and are marked THIS_DEVICE_ONLY so they never travel in an
 * iCloud or Android backup.
 */

const PIN_KEY = 'finpilot.app-lock.pin';
const SETTINGS_KEY = 'finpilot.app-lock.settings';
const ATTEMPTS_KEY = 'finpilot.app-lock.attempts';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface AppLockSettings {
  enabled: boolean;
  /** Use biometrics when the device has them; the PIN is always the fallback. */
  biometricsEnabled: boolean;
  /**
   * How long the app may sit in the background before it demands the lock
   * again. Zero means immediately.
   */
  timeoutMs: number;
}

/** The choices offered in Settings, in the order they are shown. */
export const LOCK_TIMEOUT_OPTIONS = [
  { ms: 0, label: 'Immediately' },
  { ms: 60_000, label: 'After 1 minute' },
  { ms: 5 * 60_000, label: 'After 5 minutes' },
  { ms: 15 * 60_000, label: 'After 15 minutes' },
] as const;

export const DEFAULT_LOCK_TIMEOUT_MS = 60_000;

export const DEFAULT_APP_LOCK_SETTINGS: AppLockSettings = {
  enabled: false,
  biometricsEnabled: false,
  timeoutMs: DEFAULT_LOCK_TIMEOUT_MS,
};

/**
 * A stored timeout is only honoured if it is one of the offered values. An
 * arbitrary number out of storage - a corrupted record, or a value written by
 * a future build - must never become a longer unlocked window than the user
 * chose.
 */
export function narrowTimeout(value: unknown): number {
  return LOCK_TIMEOUT_OPTIONS.some((option) => option.ms === value)
    ? (value as number)
    : DEFAULT_LOCK_TIMEOUT_MS;
}

export async function readPinRecord(): Promise<PinRecord | null> {
  const raw = await SecureStore.getItemAsync(PIN_KEY, OPTIONS);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as PinRecord;
  } catch {
    // Corrupt record: treat as "no PIN set" rather than locking the user out
    // of their own app forever.
    return null;
  }
}

export async function writePinRecord(record: PinRecord): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify(record), OPTIONS);
}

export async function clearPinRecord(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY, OPTIONS);
}

export async function readAppLockSettings(): Promise<AppLockSettings> {
  const raw = await SecureStore.getItemAsync(SETTINGS_KEY, OPTIONS);
  if (!raw) {
    return DEFAULT_APP_LOCK_SETTINGS;
  }
  try {
    const stored = JSON.parse(raw) as Partial<AppLockSettings>;
    return {
      ...DEFAULT_APP_LOCK_SETTINGS,
      ...stored,
      timeoutMs: narrowTimeout(stored.timeoutMs),
    };
  } catch {
    return DEFAULT_APP_LOCK_SETTINGS;
  }
}

export async function writeAppLockSettings(settings: AppLockSettings): Promise<void> {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings), OPTIONS);
}

/**
 * The failed-attempt counter.
 *
 * It has to survive a relaunch, or the lockout is decorative: five wrong
 * guesses, force-quit, five more, and so on until a four-digit PIN falls.
 * Stored beside the PIN, and cleared by the same paths that clear it.
 */
export async function readFailedAttempts(): Promise<number> {
  const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY, OPTIONS);
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export async function writeFailedAttempts(attempts: number): Promise<void> {
  await SecureStore.setItemAsync(ATTEMPTS_KEY, String(Math.max(0, attempts)), OPTIONS);
}

export async function clearFailedAttempts(): Promise<void> {
  await SecureStore.deleteItemAsync(ATTEMPTS_KEY, OPTIONS);
}

/** Sign-out and "forget this device" both wipe everything the lock owns. */
export async function clearAppLockStorage(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(PIN_KEY, OPTIONS),
    SecureStore.deleteItemAsync(SETTINGS_KEY, OPTIONS),
    SecureStore.deleteItemAsync(ATTEMPTS_KEY, OPTIONS),
  ]);
}
