/**
 * Global test setup.
 *
 * RNTL v14+ registers its own jest matchers (toBeOnTheScreen, toHaveStyle, ...)
 * automatically, so nothing to do there. What we do need is real randomness and
 * stand-ins for the native modules that have no JS implementation under jest.
 */

// jest-expo stubs the expo-crypto native module: `randomUUID` returns undefined
// and `getRandomValues` fills the buffer with zeros, which would make every
// client-generated id identical. Back both with Node's WebCrypto so tests
// exercise the same code path the device does.
jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports.
  const nodeCrypto = require('node:crypto');
  return {
    ...jest.requireActual('expo-crypto'),
    randomUUID: () => nodeCrypto.randomUUID(),
    getRandomValues: (array: Uint8Array) => nodeCrypto.webcrypto.getRandomValues(array),
    digestStringAsync: async (_algorithm: string, data: string) =>
      nodeCrypto.createHash('sha256').update(data, 'utf8').digest('hex'),
  };
});

// An in-memory keychain. Tests that care about its contents import
// `secureStoreMock` from '@/test-utils/native-mocks'.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
  authenticateAsync: jest.fn(async () => ({ success: false, error: 'user_cancel' })),
}));

jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' })),
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButtonType: { CONTINUE: 0 },
  AppleAuthenticationButtonStyle: { BLACK: 0, WHITE: 1 },
  AppleAuthenticationButton: () => null,
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(async () => ({ identityToken: null })),
}));

export {};
