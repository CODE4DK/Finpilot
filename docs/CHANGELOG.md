# Changelog

All notable changes to FinPilot are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Phase 1] - 2026-09-19 - Design system and navigation shell

### Added

- **Theme** (`src/theme/`): semantic colour tokens for light and dark
  (deep-teal primary, indigo accent, green income / red expense / amber warning
  / blue info), a 4pt spacing scale, radii, a typography scale with font-scale
  caps, cross-platform elevation, and a `ThemeProvider` that follows the system
  scheme with a manual light/dark override.
- **Contrast tooling** (`src/theme/contrast.ts`): WCAG relative-luminance and
  ratio maths, plus a test that asserts all 33 rendered colour pairs clear AA
  (4.5:1 for text, 3:1 for UI) in _both_ schemes. The palette was tuned until
  they passed rather than assumed.
- **Components** (`src/components/`, each with tests): `Button` (4 variants, 3
  sizes, loading, disabled), `TextInput`, `AmountInput` (paise-safe, ₹),
  `Card`, `ListItem`, `Chip`, `BottomSheet`, `EmptyState`, `Skeleton` /
  `SkeletonList`, `Toast` (provider + `useToast`), `ProgressBar`,
  `ProgressRing` (Skia-free SVG), `CategoryIcon` (16 categories), `AmountText`,
  `TabBarAddButton` and the `Screen` wrapper (safe area + keyboard handling).
- **Money** (`src/utils/money.ts`): `formatINR` with true Indian digit grouping
  (1,00,000 - not dependent on the device's ICU build), `groupIndianDigits`,
  `formatCompactINR` (₹1.25L / ₹2.4Cr), and safe arithmetic helpers
  (`addPaise`, `subtractPaise`, `multiplyPaise`, `scalePaise`, `negatePaise`,
  `absPaise`, `comparePaise`, `clampPaise`) that reject floats and unsafe
  integers. `formatPaise` now delegates to `formatINR`.
- **Navigation shell** (Expo Router): `(auth)` group (sign-in, sign-up,
  forgot-password), `(tabs)` group (Home, Transactions, **Add** as a floating
  centre button, Budgets, Reports) and a `settings` stack (index, appearance,
  about). All screens built from the component library.
- **`/dev/components`**: a live gallery of every component, guarded by
  `__DEV__` so it cannot ship in a release build.
- **Accessibility**: 44pt minimum touch targets (directly or via `hitSlop`),
  OS font scaling allowed everywhere and capped only on dense controls,
  `accessibilityLabel` + role on every interactive element, and AA contrast
  enforced by test.
- **Test infrastructure**: `src/test-utils/render.tsx` (theme + safe-area +
  toast wrapper) and router smoke tests covering all 14 routes plus the theme
  and privacy-mode flows. 275 tests total.

### Changed

- `AmountText` and the settings store now read from the theme tokens;
  `ScreenContainer` was replaced by the fuller `Screen` wrapper.
- `clampProgress` treats `NaN` as 0 and `Infinity` as 1.
- Jest `transformIgnorePatterns` widened for the ESM packages Expo Router 57
  pulls in (`standard-navigation`, `react-native-svg`, …).

### Notes

- Expo Router 57 vendors React Navigation; the JS tab bar comes from
  `expo-router/js-tabs`, which is what supports the custom centre button.
- A bottom sheet's backdrop is hidden from screen readers by RN's
  `accessibilityViewIsModal` semantics, so the sheet carries an explicit close
  button rather than relying on a backdrop tap.

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
