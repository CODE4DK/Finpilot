import * as Crypto from 'expo-crypto';

/**
 * Every row FinPilot creates gets its id on the client, before it ever reaches
 * Supabase - an offline-first app cannot wait for the server to assign one.
 */
export function createId(): string {
  return Crypto.randomUUID();
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
