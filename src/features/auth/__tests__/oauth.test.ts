import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

import {
  OAuthCancelledError,
  appScheme,
  ProviderUnavailableError,
  googleClientId,
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
} from '@/features/auth/oauth';
import { makeSession } from '@/test-utils/supabase-mock';

/**
 * The provider paths, exercised without a browser.
 *
 * The cases that matter are the unhappy ones: a user who backs out of the
 * sheet must get a cancellation the UI can ignore quietly, and a provider
 * that returns no token must not be treated as a sign-in.
 */

// `mock`-prefixed so jest allows the factories below to close over them.
const mockSignInWithIdToken = jest.fn();
jest.mock('@/features/auth/api', () => ({
  signInWithIdToken: (...args: unknown[]) => mockSignInWithIdToken(...args),
}));

const mockPromptAsync = jest.fn();
jest.mock('expo-auth-session', () => ({
  ResponseType: { IdToken: 'id_token' },
  fetchDiscoveryAsync: jest.fn(async () => ({ authorizationEndpoint: 'https://accounts.google' })),
  makeRedirectUri: jest.fn(() => 'finpilot://auth/callback'),
  AuthRequest: class {
    promptAsync = (...args: unknown[]) => mockPromptAsync(...args);
  },
}));

const ORIGINAL_ENV = { ...process.env };

/** jest-expo runs as iOS, so that is the platform these exercise. */
function runningOn(os: 'ios' | 'android'): void {
  jest.replaceProperty(Platform, 'OS', os);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSignInWithIdToken.mockResolvedValue(makeSession());
  mockPromptAsync.mockResolvedValue({ type: 'success', params: { id_token: 'google-id-token' } });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('googleClientId', () => {
  it('is undefined in a build that was not given one', () => {
    // EXPO_PUBLIC_* variables are inlined by the bundler rather than read at
    // runtime, so a test cannot set one - which is exactly why
    // signInWithGoogle takes the id as an argument.
    expect(googleClientId()).toBeUndefined();
  });
});

describe('signInWithGoogle', () => {
  it('exchanges the id token for a Supabase session', async () => {
    await expect(signInWithGoogle('ios-client')).resolves.toMatchObject({
      access_token: expect.any(String),
    });

    expect(mockSignInWithIdToken).toHaveBeenCalledWith(
      'google',
      'google-id-token',
      expect.any(String),
    );
  });

  it('sends a hashed nonce out and keeps the raw one for the exchange', async () => {
    await signInWithGoogle('ios-client');

    const [, , raw] = mockSignInWithIdToken.mock.calls[0]!;
    // The raw nonce is a UUID; the hashed one went to Google in extraParams.
    expect(raw).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuses to start without a client id, rather than failing at the browser', async () => {
    await expect(signInWithGoogle(undefined)).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(AuthSession.fetchDiscoveryAsync).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'dismiss'])('treats %s as a cancellation, not an error', async (type) => {
    mockPromptAsync.mockResolvedValue({ type });

    await expect(signInWithGoogle('ios-client')).rejects.toBeInstanceOf(OAuthCancelledError);
  });

  it('surfaces the provider error message when there is one', async () => {
    mockPromptAsync.mockResolvedValue({
      type: 'error',
      error: { message: 'redirect_uri_mismatch' },
    });

    await expect(signInWithGoogle('ios-client')).rejects.toThrow('redirect_uri_mismatch');
  });

  it('refuses a success with no identity token', async () => {
    mockPromptAsync.mockResolvedValue({ type: 'success', params: {} });

    await expect(signInWithGoogle('ios-client')).rejects.toThrow(/identity token/i);
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
  });
});

describe('Apple sign-in', () => {
  beforeEach(() => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: 'apple-id-token',
    });
  });

  it('is never offered off iOS', async () => {
    runningOn('android');

    await expect(isAppleSignInAvailable()).resolves.toBe(false);
    await expect(signInWithApple()).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it('is not offered on an iOS device that cannot do it', async () => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false);

    await expect(isAppleSignInAvailable()).resolves.toBe(false);
  });

  it('exchanges the identity token for a session', async () => {
    await expect(signInWithApple()).resolves.toMatchObject({
      access_token: expect.any(String),
    });
    expect(mockSignInWithIdToken).toHaveBeenCalledWith(
      'apple',
      'apple-id-token',
      expect.any(String),
    );
  });

  it('turns a dismissed sheet into a cancellation', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue({
      code: 'ERR_REQUEST_CANCELED',
    });

    await expect(signInWithApple()).rejects.toBeInstanceOf(OAuthCancelledError);
  });

  it('lets a real failure through unchanged', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(new Error('no network'));

    await expect(signInWithApple()).rejects.toThrow('no network');
  });

  it('refuses a credential with no identity token', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: null });

    await expect(signInWithApple()).rejects.toThrow(/identity token/i);
  });
});

describe('the redirect scheme', () => {
  it('comes from the build, not from a constant', () => {
    // Development, preview and production install side by side with different
    // schemes; a hardcoded one would send the provider's redirect to whichever
    // variant claimed it.
    expect(appScheme()).toBe(Constants.expoConfig?.scheme ?? 'finpilot');
  });

  it.each([
    [undefined, 'finpilot'],
    [null, 'finpilot'],
    ['finpilot-dev', 'finpilot-dev'],
    // A build may register more than one; the first is the canonical one.
    [['finpilot-preview', 'finpilot'], 'finpilot-preview'],
  ])('resolves %p to %p', (scheme, expected) => {
    // Injected rather than spied: `Constants.expoConfig` is a
    // non-configurable getter, and the default argument is the seam.
    expect(appScheme(scheme as string | string[] | null | undefined)).toBe(expected);
  });
});
