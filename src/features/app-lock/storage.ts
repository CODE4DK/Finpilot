import * as SecureStore from 'expo-secure-store';

import type { PinRecord } from './pin';

/**
 * The PIN record and the lock preferences live in the keychain/keystore, not
 * in AsyncStorage, and are marked THIS_DEVICE_ONLY so they never travel in an
 * iCloud or Android backup.
 */

const PIN_KEY = 'finpilot.app-lock.pin';
const SETTINGS_KEY = 'finpilot.app-lock.settings';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface AppLockSettings {
  enabled: boolean;
  /** Use biometrics when the device has them; the PIN is always the fallback. */
  biometricsEnabled: boolean;
}

export const DEFAULT_APP_LOCK_SETTINGS: AppLockSettings = {
  enabled: false,
  biometricsEnabled: false,
};

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
    return { ...DEFAULT_APP_LOCK_SETTINGS, ...(JSON.parse(raw) as Partial<AppLockSettings>) };
  } catch {
    return DEFAULT_APP_LOCK_SETTINGS;
  }
}

export async function writeAppLockSettings(settings: AppLockSettings): Promise<void> {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings), OPTIONS);
}

/** Sign-out and "forget this device" both wipe everything the lock owns. */
export async function clearAppLockStorage(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(PIN_KEY, OPTIONS),
    SecureStore.deleteItemAsync(SETTINGS_KEY, OPTIONS),
  ]);
}
