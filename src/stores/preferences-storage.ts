/**
 * Where preferences live between launches.
 *
 * Preferences are **not** secrets - a theme choice is not a credential - so
 * they go in AsyncStorage rather than the keychain. The two things that *are*
 * secrets, the session and the PIN, stay in secure storage (see
 * `src/lib/secure-store-adapter.ts` and `src/features/app-lock/storage.ts`).
 *
 * Every read is defensive. A user who upgrades from an older build can have a
 * value this version has never heard of, and a preference is never worth
 * crashing a launch over.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'finpilot.preferences.v1';

export interface StoredPreferences {
  themePreference?: string;
  privacyMode?: boolean;
  budgetAlertsEnabled?: boolean;
}

export async function readPreferences(): Promise<StoredPreferences> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as StoredPreferences) : {};
  } catch {
    return {};
  }
}

export async function writePreferences(preferences: StoredPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // A failed preference write is not worth surfacing: the app keeps the
    // value in memory, and the next change tries again.
  }
}

export async function clearPreferences(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to do - see above.
  }
}
