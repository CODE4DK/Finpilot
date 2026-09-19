import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { signInWithIdToken } from './api';
import type { Session } from '@supabase/supabase-js';

/**
 * Google and Apple sign-in.
 *
 * Both paths end at `signInWithIdToken`: the provider issues an id_token and
 * Supabase trades it for a session. Nothing here is a secret - the Google
 * client IDs are public identifiers, which is why they are EXPO_PUBLIC_.
 */

// Finishes any auth session left dangling by a backgrounded browser.
WebBrowser.maybeCompleteAuthSession();

export class OAuthCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled.');
    this.name = 'CancelledError';
  }
}

export class ProviderUnavailableError extends Error {
  constructor(provider: string) {
    super(`${provider} sign-in is not available on this device.`);
    this.name = 'ProviderUnavailableError';
  }
}

/** Apple requires the nonce hashed on the way out, raw on the way back. */
async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

/**
 * The client id for this platform.
 *
 * `EXPO_PUBLIC_*` variables are **inlined by the bundler**, not read at
 * runtime, so this cannot be varied by setting an environment variable later -
 * including in a test. That is why `signInWithGoogle` takes the id as an
 * argument, defaulted from here, the same way the API layer takes its client.
 */
export function googleClientId(): string | undefined {
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
}

export async function signInWithGoogle(
  clientId: string | undefined = googleClientId(),
): Promise<Session> {
  if (!clientId) {
    throw new ProviderUnavailableError('Google');
  }

  const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'finpilot', path: 'auth/callback' });
  const { raw, hashed } = await createNonce();

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.IdToken,
    extraParams: { nonce: hashed },
  });

  const result = await request.promptAsync(discovery);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new OAuthCancelledError();
  }
  if (result.type !== 'success') {
    throw new Error(
      result.type === 'error'
        ? (result.error?.message ?? 'Google sign-in failed.')
        : 'Google sign-in failed.',
    );
  }

  const idToken = result.params.id_token;
  if (!idToken) {
    throw new Error('Google did not return an identity token.');
  }

  return signInWithIdToken('google', idToken, raw);
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<Session> {
  if (!(await isAppleSignInAvailable())) {
    throw new ProviderUnavailableError('Apple');
  }

  const { raw, hashed } = await createNonce();

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });

    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token.');
    }

    return await signInWithIdToken('apple', credential.identityToken, raw);
  } catch (error) {
    // Apple reports a dismissed sheet as ERR_REQUEST_CANCELED.
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      throw new OAuthCancelledError();
    }
    throw error;
  }
}
