import { create } from 'zustand';

import { MAX_PIN_ATTEMPTS } from './pin';
import {
  DEFAULT_APP_LOCK_SETTINGS,
  clearFailedAttempts,
  writeFailedAttempts,
  type AppLockSettings,
} from './storage';

export interface AppLockState {
  /** False until the settings have been read out of secure storage. */
  ready: boolean;
  settings: AppLockSettings;
  /** True when the lock screen must be shown. */
  locked: boolean;
  /** Does the device actually have usable biometrics enrolled? */
  biometricsAvailable: boolean;
  hasPin: boolean;
  failedAttempts: number;
  /** Timestamp of the last background transition, for the grace period. */
  backgroundedAt: number | null;

  hydrate: (input: {
    settings: AppLockSettings;
    hasPin: boolean;
    biometricsAvailable: boolean;
    failedAttempts?: number;
  }) => void;
  setSettings: (settings: AppLockSettings) => void;
  setHasPin: (hasPin: boolean) => void;
  lock: () => void;
  unlock: () => void;
  registerFailedAttempt: () => void;
  setBackgroundedAt: (at: number | null) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  ready: false,
  settings: DEFAULT_APP_LOCK_SETTINGS,
  locked: false,
  biometricsAvailable: false,
  hasPin: false,
  failedAttempts: 0,
  backgroundedAt: null,
} satisfies Pick<
  AppLockState,
  | 'ready'
  | 'settings'
  | 'locked'
  | 'biometricsAvailable'
  | 'hasPin'
  | 'failedAttempts'
  | 'backgroundedAt'
>;

export const useAppLockStore = create<AppLockState>((set) => ({
  ...INITIAL_STATE,

  hydrate: ({ settings, hasPin, biometricsAvailable, failedAttempts = 0 }) =>
    set({
      ready: true,
      settings,
      hasPin,
      biometricsAvailable,
      // Carried across relaunches, so force-quitting does not reset the
      // lockout and hand an attacker another five guesses.
      failedAttempts: Math.min(failedAttempts, MAX_PIN_ATTEMPTS),
      // Cold start with the lock on means locked before the first frame.
      locked: settings.enabled,
    }),

  setSettings: (settings) => set({ settings }),
  setHasPin: (hasPin) => set({ hasPin }),
  lock: () => set({ locked: true }),
  unlock: () => {
    void clearFailedAttempts();
    set({ locked: false, failedAttempts: 0, backgroundedAt: null });
  },
  registerFailedAttempt: () =>
    set((state) => {
      const failedAttempts = Math.min(state.failedAttempts + 1, MAX_PIN_ATTEMPTS);
      void writeFailedAttempts(failedAttempts);
      return { failedAttempts };
    }),
  setBackgroundedAt: (backgroundedAt) => set({ backgroundedAt }),
  reset: () => set({ ...INITIAL_STATE }),
}));

export const selectLocked = (state: AppLockState) => state.locked;
export const selectLockSettings = (state: AppLockState) => state.settings;
export const selectLockReady = (state: AppLockState) => state.ready;
export const selectLockedOut = (state: AppLockState) => state.failedAttempts >= MAX_PIN_ATTEMPTS;
