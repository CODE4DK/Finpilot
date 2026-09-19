import { renderRouter, screen } from 'expo-router/testing-library';

/**
 * Smoke tests for the navigation shell: the routes exist, render, and the
 * tab bar exposes every destination (including the floating Add button) to
 * screen readers.
 */
describe('navigation shell', () => {
  it('renders the home tab at /', async () => {
    await renderRouter('app', { initialUrl: '/' });

    expect(await screen.findByLabelText('Home screen')).toBeOnTheScreen();
  });

  it('exposes every tab, with the centre Add button', async () => {
    await renderRouter('app', { initialUrl: '/' });

    await screen.findByLabelText('Home screen');
    expect(screen.getByLabelText('Transactions tab')).toBeOnTheScreen();
    expect(screen.getByLabelText('Budgets tab')).toBeOnTheScreen();
    expect(screen.getByLabelText('Reports tab')).toBeOnTheScreen();
    expect(screen.getByLabelText('Add a transaction')).toBeOnTheScreen();
  });

  it.each([
    ['/transactions', 'Transactions screen'],
    ['/add', 'Add transaction screen'],
    ['/budgets', 'Budgets screen'],
    ['/reports', 'Reports screen'],
  ])('renders %s', async (url, label) => {
    await renderRouter('app', { initialUrl: url });
    expect(await screen.findByLabelText(label)).toBeOnTheScreen();
  });

  it.each([
    ['/(auth)/sign-in', 'Sign in screen'],
    ['/(auth)/sign-up', 'Create account screen'],
    ['/(auth)/forgot-password', 'Reset password screen'],
  ])('renders %s', async (url, label) => {
    await renderRouter('app', { initialUrl: url });
    expect(await screen.findByLabelText(label)).toBeOnTheScreen();
  });

  it.each([
    ['/settings', 'Settings screen'],
    ['/settings/appearance', 'Appearance settings screen'],
    ['/settings/about', 'About screen'],
  ])('renders %s', async (url, label) => {
    await renderRouter('app', { initialUrl: url });
    expect(await screen.findByLabelText(label)).toBeOnTheScreen();
  });

  it('renders the dev component gallery in development builds', async () => {
    await renderRouter('app', { initialUrl: '/dev/components' });
    expect(await screen.findByLabelText('Component gallery screen')).toBeOnTheScreen();
  });

  it('falls back to the not-found route', async () => {
    await renderRouter('app', { initialUrl: '/nope' });
    expect(await screen.findByLabelText('Route not found screen')).toBeOnTheScreen();
  });
});
