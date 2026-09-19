import type { Session } from '@supabase/supabase-js';

import type { Tables } from '@/db';
import { getSupabaseClient, type FinPilotClient } from '@/lib/supabase';

/** The canonical profile row type for the whole auth feature. */
export type Profile = Tables<'profiles'>;

/** Sends a 6-digit code. `shouldCreateUser` lets the same screen serve sign-up. */
export async function sendEmailOtp(
  email: string,
  client: FinPilotClient = getSupabaseClient(),
): Promise<void> {
  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) {
    throw error;
  }
}

export async function verifyEmailOtp(
  email: string,
  token: string,
  client: FinPilotClient = getSupabaseClient(),
): Promise<Session> {
  const { data, error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });
  if (error) {
    throw error;
  }
  if (!data.session) {
    throw new Error('Verification succeeded but no session was returned.');
  }
  return data.session;
}

/**
 * Exchanges a provider id_token for a Supabase session. Both Google and Apple
 * use the native sign-in sheet and hand us an id_token, which avoids a browser
 * round trip entirely.
 */
export async function signInWithIdToken(
  provider: 'google' | 'apple',
  idToken: string,
  nonce: string | undefined,
  client: FinPilotClient = getSupabaseClient(),
): Promise<Session> {
  const { data, error } = await client.auth.signInWithIdToken({
    provider,
    token: idToken,
    nonce,
  });
  if (error) {
    throw error;
  }
  if (!data.session) {
    throw new Error('Sign-in succeeded but no session was returned.');
  }
  return data.session;
}

export async function fetchProfile(
  userId: string,
  client: FinPilotClient = getSupabaseClient(),
): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export interface OnboardingInput {
  fullName: string;
  currency: string;
  timezone?: string;
}

export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
  client: FinPilotClient = getSupabaseClient(),
): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      currency: input.currency,
      ...(input.timezone ? { timezone: input.timezone } : {}),
      onboarding_completed: true,
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export interface FirstAccountInput {
  id: string;
  name: string;
  type: string;
  openingBalancePaise: number;
}

export async function createFirstAccount(
  userId: string,
  input: FirstAccountInput,
  client: FinPilotClient = getSupabaseClient(),
): Promise<void> {
  const { error } = await client.from('accounts').insert({
    id: input.id,
    user_id: userId,
    name: input.name.trim(),
    type: input.type,
    opening_balance_paise: input.openingBalancePaise,
  });
  if (error) {
    throw error;
  }
}

export async function signOut(client: FinPilotClient = getSupabaseClient()): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}
