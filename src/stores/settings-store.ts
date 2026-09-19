import { create } from 'zustand';

export type CurrencyCode = 'INR';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface SettingsState {
  currency: CurrencyCode;
  /** Locale used for number and date formatting at display time. */
  locale: string;
  themePreference: ThemePreference;
  /** Hides amounts on screen - handy on a shared or public device. */
  privacyMode: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  togglePrivacyMode: () => void;
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
  reset: () => set({ ...INITIAL_STATE }),
}));
