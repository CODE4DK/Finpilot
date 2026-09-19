/**
 * Global test setup.
 *
 * RNTL v14+ registers its own jest matchers (toBeOnTheScreen, toHaveStyle, ...)
 * automatically, so nothing to do there. What we do need is real randomness:
 * jest-expo stubs the expo-crypto native module, and its `randomUUID` returns
 * undefined while `getRandomValues` fills the buffer with zeros - which would
 * make every client-generated id identical. Back both with Node's WebCrypto so
 * tests exercise the same code path the device does.
 */
jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports.
  const nodeCrypto = require('node:crypto');
  return {
    ...jest.requireActual('expo-crypto'),
    randomUUID: () => nodeCrypto.randomUUID(),
    getRandomValues: (array: Uint8Array) => nodeCrypto.webcrypto.getRandomValues(array),
  };
});

export {};
