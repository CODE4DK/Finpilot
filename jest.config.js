const expoPreset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // The preset only transforms .js/.ts; some dependencies (PowerSync's
  // websocket bundle, for one) ship .mjs, which Node then refuses to parse as
  // CommonJS. Reuse the preset's babel transform for those too.
  transform: {
    ...expoPreset.transform,
    '^.+\\.mjs$': expoPreset.transform['\\.[jt]sx?$'],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node', 'mjs'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Packages that ship untranspiled ESM and must go through babel.
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?(' +
      [
        '(jest-)?react-native',
        '@react-native(-community)?',
        'expo(nent)?',
        '@expo(nent)?/.*',
        'expo-router',
        'expo-modules-core',
        '@expo-google-fonts/.*',
        'standard-navigation',
        'react-navigation',
        '@react-navigation/.*',
        '@sentry/react-native',
        'react-native-svg',
        'react-native-safe-area-context',
        'react-native-gesture-handler',
        'react-native-worklets',
        'react-native-reanimated',
        '@powersync/.*',
        '@op-engineering/.*',
        'uuid',
      ].join('|') +
      '))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
    // Generated, and an index file is re-exports with nothing to cover.
    '!src/db/database.types.ts',
    '!**/index.ts',
  ],
  coverageReporters: ['text-summary', 'json-summary', 'lcov'],
  /**
   * The floor, enforced rather than reported. It is set per directory because
   * a single global number lets a well-tested util subsidise an untested
   * feature - the average passes while the risk sits where it always did.
   *
   * `src/features` and `src/utils` are where the money maths, the sync rules
   * and the privacy boundary live, so they carry the 80% the phase asks for.
   */
  coverageThreshold: {
    './src/features/': { statements: 80, branches: 80, functions: 80, lines: 80 },
    './src/utils/': { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
  /**
   * Instrumentation slows every render, and the router tests wait on screens
   * that now take longer than RNTL's one-second default - which showed up as
   * tests that passed alone and failed under `--coverage`. Waiting longer
   * costs nothing when the assertion is going to pass.
   */
  testTimeout: 30_000,
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/.expo/'],
};
