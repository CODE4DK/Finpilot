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

/**
 * Swipeable rows.
 *
 * Reanimated's own mock imports the real library, which needs the native
 * worklets module, so it cannot be used here. The gesture itself is not
 * testable in a unit test either way - what matters is that the row's content
 * and its actions render, so this renders both without any animation. The
 * swipe gesture is covered by the Maestro suite instead.
 */
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports.
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- as above.
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: ({
      children,
      renderLeftActions,
      renderRightActions,
      testID,
    }: {
      children: React.ReactNode;
      renderLeftActions?: () => React.ReactNode;
      renderRightActions?: () => React.ReactNode;
      testID?: string;
    }) =>
      React.createElement(
        View,
        { testID },
        children,
        renderLeftActions ? React.createElement(renderLeftActions) : null,
        renderRightActions ? React.createElement(renderRightActions) : null,
      ),
  };
});

// The local database itself. op-sqlite cannot open a database under Jest, so
// every test gets a fake instance; the repositories - where the logic lives -
// are tested directly against `createMockDatabase` instead.
jest.mock('@/db/powersync', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports.
  const { createFakePowerSync } = require('@/test-utils/fake-powersync');
  const instance = createFakePowerSync();
  return {
    DATABASE_FILENAME: 'finpilot.sqlite',
    getPowerSync: jest.fn(() => instance),
    connectPowerSync: jest.fn(async () => {}),
    disconnectPowerSync: jest.fn(async () => {}),
    disconnectAndClearPowerSync: jest.fn(async () => {}),
    resetPowerSyncInstance: jest.fn(),
  };
});

// op-sqlite is the native SQLite engine PowerSync runs on. It has no JS
// implementation, so importing anything from @powersync/react-native under
// Jest would throw "Base module not found". The repositories are tested
// against `createMockDatabase` instead - see src/test-utils/mock-database.ts.
jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => {
    throw new Error('op-sqlite is not available under Jest');
  }),
  isSQLCipher: jest.fn(() => false),
  isLibsql: jest.fn(() => false),
  isIOSEmbeeded: jest.fn(() => false),
  getDylibPath: jest.fn(() => ''),
  moveAssetsDatabase: jest.fn(async () => false),
  IOS_LIBRARY_PATH: '',
  IOS_DOCUMENT_PATH: '',
  ANDROID_DATABASE_PATH: '',
  ANDROID_FILES_PATH: '',
  ANDROID_EXTERNAL_FILES_PATH: '',
}));

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
