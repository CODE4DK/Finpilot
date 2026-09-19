/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
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
      ].join('|') +
      '))',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}', '!**/*.d.ts', '!**/__tests__/**'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/.expo/'],
};
