import AsyncStorage from '@react-native-async-storage/async-storage';

import { readPreferences, writePreferences } from '@/stores/preferences-storage';
import { useSettingsStore } from '@/stores/settings-store';

const KEY = 'finpilot.preferences.v1';

describe('preferences survive a restart', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSettingsStore.getState().reset();
  });

  it('writes a changed preference straight away', async () => {
    useSettingsStore.getState().setThemePreference('dark');

    // The store does not await the write, so let the microtask settle.
    await Promise.resolve();

    expect(await readPreferences()).toMatchObject({ themePreference: 'dark' });
  });

  it('reads it back into the store on the next launch', async () => {
    await writePreferences({ themePreference: 'light', privacyMode: true });

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().themePreference).toBe('light');
    expect(useSettingsStore.getState().privacyMode).toBe(true);
    expect(useSettingsStore.getState().hydrated).toBe(true);
  });

  it('ignores a theme this build has never heard of', async () => {
    // A downgrade, or a future build's value: the default is better than a
    // crash or a theme that does not exist.
    await writePreferences({ themePreference: 'solarized' });

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().themePreference).toBe('system');
  });

  it('ignores a value of the wrong type', async () => {
    await writePreferences({ privacyMode: 'yes' as unknown as boolean });

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().privacyMode).toBe(false);
  });

  it('survives a corrupt record rather than failing the launch', async () => {
    await AsyncStorage.setItem(KEY, '{not json');

    expect(await readPreferences()).toEqual({});
    await expect(useSettingsStore.getState().hydrate()).resolves.toBeUndefined();
  });

  it('starts from the defaults when nothing has been stored', async () => {
    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().themePreference).toBe('system');
    expect(useSettingsStore.getState().budgetAlertsEnabled).toBe(false);
  });

  it('forgets everything on sign-out, on disk as well as in memory', async () => {
    useSettingsStore.getState().setThemePreference('dark');
    useSettingsStore.getState().setBudgetAlertsEnabled(true);
    await Promise.resolve();

    await useSettingsStore.getState().clear();

    expect(useSettingsStore.getState().themePreference).toBe('system');
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});
