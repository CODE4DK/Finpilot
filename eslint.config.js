// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'coverage/*'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Supabase Edge Functions run on Deno, which resolves imports through the
    // function's own import map (deno.json) rather than node_modules, and has
    // its own globals. `deno check` type-checks them - see docs/AI_INSIGHTS.md.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: { Deno: 'readonly' },
    },
    rules: {
      'import/no-unresolved': 'off',
    },
  },
  {
    // Node CLI scripts talk to the developer through stdout, and run in
    // CommonJS where __dirname and module exist.
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { __dirname: 'readonly', module: 'writable', require: 'readonly' },
    },
    rules: {
      'no-console': 'off',
    },
  },
]);
