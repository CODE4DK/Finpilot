import * as Crypto from 'expo-crypto';

/**
 * PIN hashing.
 *
 * Be honest about the threat model: a 4-digit PIN has 10,000 possibilities, so
 * *no* hash makes a stolen hash safe from an offline sweep. What the hash buys
 * is that the PIN is not sitting in storage in the clear. The real protections
 * are that the record lives in the device keychain/keystore (hardware backed,
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, not in any backup) and that we lock out
 * after a handful of wrong attempts.
 *
 * The iteration count is a deliberate compromise: expo-crypto hashes across
 * the native bridge, so each round costs a call. A few thousand rounds keep
 * unlock imperceptible while making a naive sweep meaningfully slower.
 */

export const PIN_LENGTH = 4;
export const PIN_HASH_ITERATIONS = 2000;
export const PIN_SALT_BYTES = 16;
export const MAX_PIN_ATTEMPTS = 5;

export class PinError extends Error {}

export interface PinRecord {
  /** Hex-encoded salt. */
  salt: string;
  /** Hex-encoded digest. */
  hash: string;
  iterations: number;
  /** Bumped if the scheme ever changes, so old records can be migrated. */
  version: 1;
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export function assertValidPin(pin: string): string {
  if (!isValidPin(pin)) {
    throw new PinError(`A PIN must be exactly ${PIN_LENGTH} digits.`);
  }
  return pin;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateSalt(bytes: number = PIN_SALT_BYTES): string {
  return toHex(Crypto.getRandomValues(new Uint8Array(bytes)));
}

/**
 * Iterated SHA-256 over `salt:pin`, feeding each digest back in. Not PBKDF2 -
 * expo-crypto does not expose it - but the same stretching idea.
 */
export async function derivePinHash(
  pin: string,
  salt: string,
  iterations: number = PIN_HASH_ITERATIONS,
): Promise<string> {
  assertValidPin(pin);
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new PinError(`Iterations must be a positive integer, received: ${iterations}`);
  }

  let digest = `${salt}:${pin}`;
  for (let round = 0; round < iterations; round += 1) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digest);
  }
  return digest;
}

export async function createPinRecord(
  pin: string,
  iterations: number = PIN_HASH_ITERATIONS,
): Promise<PinRecord> {
  const salt = generateSalt();
  return {
    salt,
    hash: await derivePinHash(pin, salt, iterations),
    iterations,
    version: 1,
  };
}

/**
 * Constant-time-ish comparison. JS strings cannot give a real guarantee, but
 * comparing every character removes the obvious early-exit signal.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  if (!isValidPin(pin)) {
    return false;
  }
  const candidate = await derivePinHash(pin, record.salt, record.iterations);
  return safeEqual(candidate, record.hash);
}

export interface AttemptState {
  failedAttempts: number;
  lockedOut: boolean;
  remainingAttempts: number;
}

/** After MAX_PIN_ATTEMPTS wrong tries the PIN path closes until re-auth. */
export function nextAttemptState(failedAttempts: number, correct: boolean): AttemptState {
  const next = correct ? 0 : failedAttempts + 1;
  return {
    failedAttempts: next,
    lockedOut: next >= MAX_PIN_ATTEMPTS,
    remainingAttempts: Math.max(MAX_PIN_ATTEMPTS - next, 0),
  };
}
