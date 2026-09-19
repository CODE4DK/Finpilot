import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { useSettingsStore } from '@/stores/settings-store';

describe('settings flows', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
  });

  it('switches the theme from the appearance screen', async () => {
    await renderRouter('app', { initialUrl: '/settings/appearance' });
    await screen.findByLabelText('Appearance settings screen');

    await fireEvent.press(screen.getByLabelText('Dark theme'));
    expect(useSettingsStore.getState().themePreference).toBe('dark');

    await fireEvent.press(screen.getByLabelText('Follow system theme'));
    expect(useSettingsStore.getState().themePreference).toBe('system');
  });

  it('toggles privacy mode from the home header and hides the balance', async () => {
    await renderRouter('app', { initialUrl: '/' });
    await screen.findByLabelText('Home screen');

    expect(screen.getByLabelText('₹1,24,567.00')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Hide amounts'));
    expect(useSettingsStore.getState().privacyMode).toBe(true);
    expect(screen.getByLabelText('Balance hidden by privacy mode')).toBeOnTheScreen();
    expect(screen.queryByLabelText('₹1,24,567.00')).not.toBeOnTheScreen();
  });

  it('toggles privacy mode from the settings switch', async () => {
    await renderRouter('app', { initialUrl: '/settings' });
    await screen.findByLabelText('Settings screen');

    await fireEvent(screen.getByLabelText('Toggle privacy mode'), 'valueChange', true);
    expect(useSettingsStore.getState().privacyMode).toBe(true);
  });
});
