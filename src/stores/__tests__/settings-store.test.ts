import { useSettingsStore } from '@/stores/settings-store';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
  });

  it('defaults to INR and the Indian locale', () => {
    const state = useSettingsStore.getState();
    expect(state.currency).toBe('INR');
    expect(state.locale).toBe('en-IN');
    expect(state.themePreference).toBe('system');
    expect(state.privacyMode).toBe(false);
  });

  it('toggles privacy mode', () => {
    useSettingsStore.getState().togglePrivacyMode();
    expect(useSettingsStore.getState().privacyMode).toBe(true);
    useSettingsStore.getState().togglePrivacyMode();
    expect(useSettingsStore.getState().privacyMode).toBe(false);
  });

  it('stores a theme preference', () => {
    useSettingsStore.getState().setThemePreference('dark');
    expect(useSettingsStore.getState().themePreference).toBe('dark');
  });

  it('resets back to the defaults', () => {
    useSettingsStore.getState().setThemePreference('light');
    useSettingsStore.getState().togglePrivacyMode();
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().themePreference).toBe('system');
    expect(useSettingsStore.getState().privacyMode).toBe(false);
  });
});
