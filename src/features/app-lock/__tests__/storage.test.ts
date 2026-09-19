import * as SecureStore from 'expo-secure-store';

import { useAppLockStore } from '@/features/app-lock/app-lock-store';
import { MAX_PIN_ATTEMPTS } from '@/features/app-lock/pin';
import {
  DEFAULT_APP_LOCK_SETTINGS,
  DEFAULT_LOCK_TIMEOUT_MS,
  clearAppLockStorage,
  readAppLockSettings,
  readFailedAttempts,
  readPinRecord,
  writeAppLockSettings,
  writePinRecord,
} from '@/features/app-lock/storage';

/**
 * The lock's storage layer.
 *
 * Everything here is read on a cold start, which is the moment the app is
 * least able to recover from a surprise: a corrupt record must not lock a
 * person out of their own data, and it must not let them in either.
 */

const store = SecureStore as unknown as {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  store.getItemAsync.mockResolvedValue(null);
});

describe('the settings record', () => {
  it('is the defaults when nothing has been written', async () => {
    await expect(readAppLockSettings()).resolves.toEqual(DEFAULT_APP_LOCK_SETTINGS);
  });

  it('round-trips what was written', async () => {
    const settings = { enabled: true, biometricsEnabled: true, timeoutMs: 300_000 };
    store.getItemAsync.mockResolvedValue(JSON.stringify(settings));

    await expect(readAppLockSettings()).resolves.toEqual(settings);
  });

  it('falls back to the defaults on a corrupt record', async () => {
    store.getItemAsync.mockResolvedValue('{not json');

    await expect(readAppLockSettings()).resolves.toEqual(DEFAULT_APP_LOCK_SETTINGS);
  });

  it('fills in a field an older build never wrote', async () => {
    store.getItemAsync.mockResolvedValue(JSON.stringify({ enabled: true }));

    await expect(readAppLockSettings()).resolves.toEqual({
      enabled: true,
      biometricsEnabled: false,
      timeoutMs: DEFAULT_LOCK_TIMEOUT_MS,
    });
  });

  it('refuses a timeout that is not one of the offered values', async () => {
    // A corrupt or forged record must not widen the unlocked window.
    store.getItemAsync.mockResolvedValue(
      JSON.stringify({ enabled: true, timeoutMs: 24 * 60 * 60_000 }),
    );

    await expect(readAppLockSettings()).resolves.toMatchObject({
      timeoutMs: DEFAULT_LOCK_TIMEOUT_MS,
    });
  });

  it('is written to the keychain, never to a backup', async () => {
    await writeAppLockSettings(DEFAULT_APP_LOCK_SETTINGS);

    expect(store.setItemAsync).toHaveBeenCalledWith(
      'finpilot.app-lock.settings',
      expect.any(String),
      expect.objectContaining({
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    );
  });
});

describe('the PIN record', () => {
  it('is null when none has been set', async () => {
    await expect(readPinRecord()).resolves.toBeNull();
  });

  it('round-trips a written record', async () => {
    const record = { salt: 'abc', hash: 'def', iterations: 2000, version: 1 as const };
    await writePinRecord(record);
    store.getItemAsync.mockResolvedValue(JSON.stringify(record));

    await expect(readPinRecord()).resolves.toEqual(record);
  });

  it('treats a corrupt record as "no PIN" rather than locking the user out forever', async () => {
    store.getItemAsync.mockResolvedValue('}broken{');

    await expect(readPinRecord()).resolves.toBeNull();
  });
});

describe('the failed-attempt counter', () => {
  it('is zero when nothing is stored', async () => {
    await expect(readFailedAttempts()).resolves.toBe(0);
  });

  it('reads back a count', async () => {
    store.getItemAsync.mockResolvedValue('3');

    await expect(readFailedAttempts()).resolves.toBe(3);
  });

  it('ignores a value that is not a count', async () => {
    store.getItemAsync.mockResolvedValue('lots');

    await expect(readFailedAttempts()).resolves.toBe(0);
  });
});

describe('clearing everything', () => {
  it('removes the PIN, the settings and the attempt count together', async () => {
    await clearAppLockStorage();

    const keys = store.deleteItemAsync.mock.calls.map(([key]) => key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'finpilot.app-lock.pin',
        'finpilot.app-lock.settings',
        'finpilot.app-lock.attempts',
      ]),
    );
  });
});

describe('the store', () => {
  beforeEach(() => {
    useAppLockStore.getState().reset();
  });

  it('is not ready until it has been hydrated', () => {
    expect(useAppLockStore.getState().ready).toBe(false);

    useAppLockStore.getState().hydrate({
      settings: DEFAULT_APP_LOCK_SETTINGS,
      hasPin: false,
      biometricsAvailable: false,
    });

    expect(useAppLockStore.getState().ready).toBe(true);
  });

  it('locks and unlocks', () => {
    useAppLockStore.getState().lock();
    expect(useAppLockStore.getState().locked).toBe(true);

    useAppLockStore.getState().unlock();
    expect(useAppLockStore.getState().locked).toBe(false);
  });

  it('stops counting attempts at the maximum', () => {
    for (let attempt = 0; attempt < MAX_PIN_ATTEMPTS + 3; attempt += 1) {
      useAppLockStore.getState().registerFailedAttempt();
    }

    expect(useAppLockStore.getState().failedAttempts).toBe(MAX_PIN_ATTEMPTS);
  });

  it('remembers when the app went to the background, and forgets on return', () => {
    useAppLockStore.getState().setBackgroundedAt(1_000);
    expect(useAppLockStore.getState().backgroundedAt).toBe(1_000);

    useAppLockStore.getState().setBackgroundedAt(null);
    expect(useAppLockStore.getState().backgroundedAt).toBeNull();
  });

  it('records a PIN being set or cleared', () => {
    useAppLockStore.getState().setHasPin(true);
    expect(useAppLockStore.getState().hasPin).toBe(true);

    useAppLockStore.getState().setHasPin(false);
    expect(useAppLockStore.getState().hasPin).toBe(false);
  });
});
