import { create } from 'zustand';

import type { ThemePreference } from '@/theme';

export type CurrencyCode = 'INR';

export interface SettingsState {
  currency: CurrencyCode;
  /** Locale used for date formatting at display time. */
  locale: string;
  /** 'system' follows the OS; 'light'/'dark' are manual overrides. */
  themePreference: ThemePreference;
  /** Hides amounts on screen - handy on a shared or public device. */
  privacyMode: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  togglePrivacyMode: () => void;
  setPrivacyMode: (enabled: boolean) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  currency: 'INR',
  locale: 'en-IN',
  themePreference: 'system',
  privacyMode: false,
} satisfies Pick<SettingsState, 'currency' | 'locale' | 'themePreference' | 'privacyMode'>;

export const useSettingsStore = create<SettingsState>((set) => ({
  ...INITIAL_STATE,
  setThemePreference: (themePreference) => set({ themePreference }),
  togglePrivacyMode: () => set((state) => ({ privacyMode: !state.privacyMode })),
  setPrivacyMode: (privacyMode) => set({ privacyMode }),
  reset: () => set({ ...INITIAL_STATE }),
}));

/** Selector helpers keep screens from re-rendering on unrelated changes. */
export const selectThemePreference = (state: SettingsState) => state.themePreference;
export const selectPrivacyMode = (state: SettingsState) => state.privacyMode;
