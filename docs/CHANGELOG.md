# Changelog

All notable changes to FinPilot are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Phase 0] - 2026-09-19 - Project foundation

### Added

- Expo SDK 57 + TypeScript app (`finpilot`) configured for **development
  builds** via `expo-dev-client`; Expo Go is not used.
- Expo Router with typed routes: root `_layout.tsx`, a placeholder `index`
  home screen and a `+not-found` route.
- TypeScript in strict mode (plus `noUncheckedIndexedAccess`, `noUnusedLocals`,
  `noUnusedParameters`) and the `@/` → `src/` path alias, wired for both `tsc`
  and Metro (`babel-plugin-module-resolver`) and Jest (`moduleNameMapper`).
- ESLint (flat config, `eslint-config-expo` + `eslint-config-prettier`),
  Prettier and `.editorconfig`.
- npm scripts: `start`, `android`, `ios`, `lint`, `lint:fix`, `typecheck`,
  `test`, `test:watch`, `format`, `format:check`.
- Jest with the `jest-expo` preset and React Native Testing Library; 50 passing
  tests across money, id, date, env, settings store and `<AmountText />`.
- Project structure: `app/`, `src/components`, `src/features`, `src/lib`,
  `src/db`, `src/theme`, `src/stores`, `src/utils`, `supabase/`, `docs/`.
- `src/utils/money.ts` — integer-paise money core: `rupeesToPaise`,
  `parseAmountToPaise`, `formatPaise` (en-IN, ₹), `sumPaise`, `splitPaise`
  (remainder-safe), `percentageOfPaise`.
- `src/utils/id.ts` — client-generated UUIDs via `expo-crypto`.
- `src/utils/date.ts` — ISO timestamps and local day/month keys.
- `src/lib/env.ts` — typed, validated access to the three `EXPO_PUBLIC_*`
  variables, with a non-throwing variant.
- `src/theme/` — color, spacing and typography tokens with light and dark
  palettes.
- `src/stores/settings-store.ts` — Zustand store (INR, `en-IN`, theme
  preference, privacy mode).
- `src/components/` — `ScreenContainer` and `AmountText`, both labelled for
  screen readers.
- `eas.json` with `development` (dev client), `preview` and `production`
  profiles.
- `.env.example` for `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_POWERSYNC_URL`; `.env` is
  git-ignored.
- `CLAUDE.md` (overview, stack, structure, commands, conventions, phase
  checklist), this changelog and a README with setup instructions.

### Notes

- Supabase, PowerSync, Victory Native, Sentry and Maestro are not wired up yet
  — their folders and conventions are in place and they land in later phases.
