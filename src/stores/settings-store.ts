import { create } from 'zustand';

import type { ThemePreference } from '@/theme';

import { clearPreferences, readPreferences, writePreferences } from './preferences-storage';

export type CurrencyCode = 'INR';

export interface SettingsState {
  currency: CurrencyCode;
  /** Locale used for date formatting at display time. */
  locale: string;
  /** 'system' follows the OS; 'light'/'dark' are manual overrides. */
  themePreference: ThemePreference;
  /** Hides amounts on screen - handy on a shared or public device. */
  privacyMode: boolean;
  /**
   * Budget alerts. Off until the user turns them on, which is also when
   * notification permission is requested - never at launch.
   */
  budgetAlertsEnabled: boolean;
  /** False until the stored preferences have been read back. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setThemePreference: (preference: ThemePreference) => void;
  togglePrivacyMode: () => void;
  setPrivacyMode: (enabled: boolean) => void;
  setBudgetAlertsEnabled: (enabled: boolean) => void;
  /** Sign-out: back to defaults, and forget what was stored. */
  clear: () => Promise<void>;
  reset: () => void;
}

const INITIAL_STATE = {
  currency: 'INR',
  locale: 'en-IN',
  themePreference: 'system',
  privacyMode: false,
  budgetAlertsEnabled: false,
  hydrated: false,
} satisfies Pick<
  SettingsState,
  'currency' | 'locale' | 'themePreference' | 'privacyMode' | 'budgetAlertsEnabled' | 'hydrated'
>;

const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

/** Only values this build understands survive a read. */
function narrowTheme(value: unknown): ThemePreference | null {
  return THEME_PREFERENCES.includes(value as ThemePreference) ? (value as ThemePreference) : null;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...INITIAL_STATE,

  hydrate: async () => {
    const stored = await readPreferences();
    set({
      themePreference: narrowTheme(stored.themePreference) ?? get().themePreference,
      privacyMode: typeof stored.privacyMode === 'boolean' ? stored.privacyMode : get().privacyMode,
      budgetAlertsEnabled:
        typeof stored.budgetAlertsEnabled === 'boolean'
          ? stored.budgetAlertsEnabled
          : get().budgetAlertsEnabled,
      hydrated: true,
    });
  },

  setThemePreference: (themePreference) => {
    set({ themePreference });
    void persist(get());
  },
  togglePrivacyMode: () => {
    set((state) => ({ privacyMode: !state.privacyMode }));
    void persist(get());
  },
  setPrivacyMode: (privacyMode) => {
    set({ privacyMode });
    void persist(get());
  },
  setBudgetAlertsEnabled: (budgetAlertsEnabled) => {
    set({ budgetAlertsEnabled });
    void persist(get());
  },

  clear: async () => {
    set({ ...INITIAL_STATE, hydrated: true });
    await clearPreferences();
  },
  reset: () => set({ ...INITIAL_STATE }),
}));

/**
 * Writes the whole preference set rather than a patch: it is three fields, and
 * a single key means a half-written state is impossible.
 */
function persist(state: SettingsState): Promise<void> {
  return writePreferences({
    themePreference: state.themePreference,
    privacyMode: state.privacyMode,
    budgetAlertsEnabled: state.budgetAlertsEnabled,
  });
}

/** Selector helpers keep screens from re-rendering on unrelated changes. */
export const selectThemePreference = (state: SettingsState) => state.themePreference;
export const selectPrivacyMode = (state: SettingsState) => state.privacyMode;
export const selectBudgetAlertsEnabled = (state: SettingsState) => state.budgetAlertsEnabled;
