import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/db/database.types';
import { readEnv, type AppEnv } from '@/lib/env';
import { createSecureStorage, type SecureStorage } from '@/lib/secure-store-adapter';

export type FinPilotClient = SupabaseClient<Database>;

export interface CreateClientOptions {
  /** Injectable for tests. */
  storage?: SecureStorage;
}

/**
 * Builds a Supabase client. The session lives in the device keychain/keystore
 * via `createSecureStorage`, never in AsyncStorage - it is a credential.
 *
 * `detectSessionInUrl` is off because there is no URL bar on a device; the
 * OAuth redirect is handled explicitly in `src/features/auth/oauth.ts`.
 */
export function createSupabaseClient(
  env: AppEnv,
  options: CreateClientOptions = {},
): FinPilotClient {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: options.storage ?? createSecureStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

let client: FinPilotClient | null = null;

/**
 * The app-wide client, created on first use so that importing this module
 * never throws before the env has been read.
 */
export function getSupabaseClient(): FinPilotClient {
  client ??= createSupabaseClient(readEnv());
  return client;
}

/** Test seam: drops the memoised client. */
export function resetSupabaseClient(): void {
  client = null;
}

/**
 * supabase-js refreshes the access token on a timer, which the OS suspends in
 * the background. Tying the timer to foreground/background keeps it from
 * firing uselessly - and from staying stopped after a long background.
 */
export function startSupabaseAutoRefresh(
  supabase: FinPilotClient = getSupabaseClient(),
): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }

  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });

  void supabase.auth.startAutoRefresh();

  return () => {
    subscription.remove();
    void supabase.auth.stopAutoRefresh();
  };
}
