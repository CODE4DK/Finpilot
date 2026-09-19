import { ROUTES, groupOf, resolveRedirect, type RouteState } from '@/features/auth/routing';

const SIGNED_OUT: RouteState = {
  session: null,
  onboardingCompleted: null,
  locked: false,
  initialising: false,
};
const ONBOARDING: RouteState = {
  session: { userId: 'alice' },
  onboardingCompleted: false,
  locked: false,
  initialising: false,
};
const READY: RouteState = {
  session: { userId: 'alice' },
  onboardingCompleted: true,
  locked: false,
  initialising: false,
};
const LOCKED: RouteState = { ...READY, locked: true };

describe('groupOf', () => {
  it.each([
    [['(auth)', 'welcome'], 'auth'],
    [['(onboarding)', 'profile'], 'onboarding'],
    [['(lock)', 'unlock'], 'lock'],
    [['(tabs)', 'index'], 'app'],
    [['settings', 'appearance'], 'app'],
    [['dev', 'components'], 'app'],
    [['+not-found'], 'unknown'],
    [[], 'unknown'],
  ] as const)('maps %p to %s', (segments, expected) => {
    expect(groupOf(segments)).toBe(expected);
  });
});

describe('resolveRedirect', () => {
  it('stays put while initialising, wherever the user is', () => {
    expect(resolveRedirect({ ...SIGNED_OUT, initialising: true }, ['(tabs)'])).toBeNull();
    expect(resolveRedirect({ ...READY, initialising: true }, ['(auth)', 'welcome'])).toBeNull();
  });

  describe('signed out', () => {
    it('sends an unauthenticated user to welcome', () => {
      expect(resolveRedirect(SIGNED_OUT, ['(tabs)', 'index'])).toBe(ROUTES.welcome);
      expect(resolveRedirect(SIGNED_OUT, ['settings'])).toBe(ROUTES.welcome);
      expect(resolveRedirect(SIGNED_OUT, ['(onboarding)', 'profile'])).toBe(ROUTES.welcome);
      expect(resolveRedirect(SIGNED_OUT, ['(lock)', 'unlock'])).toBe(ROUTES.welcome);
    });

    it('leaves them alone inside the auth group', () => {
      expect(resolveRedirect(SIGNED_OUT, ['(auth)', 'welcome'])).toBeNull();
      expect(resolveRedirect(SIGNED_OUT, ['(auth)', 'verify'])).toBeNull();
    });
  });

  describe('locked', () => {
    it('sends a locked user to the unlock screen from anywhere', () => {
      expect(resolveRedirect(LOCKED, ['(tabs)', 'index'])).toBe(ROUTES.lock);
      expect(resolveRedirect(LOCKED, ['settings'])).toBe(ROUTES.lock);
      expect(resolveRedirect(LOCKED, ['(auth)', 'welcome'])).toBe(ROUTES.lock);
    });

    it('leaves them on the unlock screen', () => {
      expect(resolveRedirect(LOCKED, ['(lock)', 'unlock'])).toBeNull();
    });

    it('takes priority over unfinished onboarding', () => {
      expect(resolveRedirect({ ...ONBOARDING, locked: true }, ['(onboarding)', 'profile'])).toBe(
        ROUTES.lock,
      );
    });
  });

  describe('onboarding', () => {
    it('sends a new user to onboarding', () => {
      expect(resolveRedirect(ONBOARDING, ['(tabs)', 'index'])).toBe(ROUTES.onboarding);
      expect(resolveRedirect(ONBOARDING, ['(auth)', 'welcome'])).toBe(ROUTES.onboarding);
    });

    it('leaves them inside the onboarding group', () => {
      expect(resolveRedirect(ONBOARDING, ['(onboarding)', 'account'])).toBeNull();
    });

    it('waits rather than guessing while the profile loads', () => {
      const loading: RouteState = { ...READY, onboardingCompleted: null };
      expect(resolveRedirect(loading, ['(tabs)', 'index'])).toBeNull();
      expect(resolveRedirect(loading, ['(onboarding)', 'profile'])).toBeNull();
    });
  });

  describe('signed in and ready', () => {
    it('pushes them out of auth, lock and onboarding', () => {
      expect(resolveRedirect(READY, ['(auth)', 'welcome'])).toBe(ROUTES.home);
      expect(resolveRedirect(READY, ['(lock)', 'unlock'])).toBe(ROUTES.home);
      expect(resolveRedirect(READY, ['(onboarding)', 'profile'])).toBe(ROUTES.home);
    });

    it('leaves them alone inside the app', () => {
      expect(resolveRedirect(READY, ['(tabs)', 'index'])).toBeNull();
      expect(resolveRedirect(READY, ['settings', 'appearance'])).toBeNull();
    });

    it('does not redirect an unknown route, so +not-found can render', () => {
      expect(resolveRedirect(READY, ['+not-found'])).toBeNull();
    });
  });
});
