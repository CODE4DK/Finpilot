# Changelog

All notable changes to FinPilot are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Phase 3] - 2026-09-19 - Authentication, onboarding and app lock

### Added

- **Supabase client** (`src/lib/supabase.ts`) built as a factory with a lazily
  memoised singleton, PKCE flow, and auto-refresh tied to foreground/background
  so the timer is not left running - or stopped - by the OS.
- **Chunking secure storage** (`src/lib/secure-store-adapter.ts`): SecureStore
  rejects values over 2048 bytes and a session with a fat JWT exceeds that, so
  large values are split across numbered keys and stitched back on read, with
  orphan cleanup when a value shrinks and a null (not corrupt) read when a
  slice is missing.
- **Auth screens**: Welcome (email / Google / Apple), Email, and Verify with a
  6-box OTP field backed by one hidden input (so the OS autofills the code and
  screen readers get one labelled control) and a 30-second resend timer.
- **Google and Apple sign-in** (`src/features/auth/oauth.ts`) via native
  id_token exchange - no browser round trip - with a hashed nonce.
- **Auth store and route guard**: `AuthGate` restores the session, loads the
  profile, runs the lock lifecycle and redirects from the pure
  `resolveRedirect`. Order is lock → onboarding → app; a null profile means
  "unknown" and holds position rather than re-running onboarding.
- **Onboarding wizard** driven by `profiles.onboarding_completed`: name and
  currency, first account with an opening balance in paise, then an optional
  app-lock setup, which writes the account and profile in one step.
- **App lock**: biometrics via expo-local-authentication with a 4-digit PIN
  fallback. The PIN is stored as a salted, 2000-round SHA-256 digest in the
  keychain/keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), with a five-attempt
  lockout that falls back to signing in again. Locks on cold start and after
  one minute in the background.
- **App-switcher privacy**: a `PrivacyCover` drawn whenever AppState is not
  `active` (iOS snapshots the last frame) plus `FLAG_SECURE` via
  expo-screen-capture (Android renders recents live).
- **Friendly error handling** (`src/features/auth/errors.ts`): wrong OTP,
  expired OTP, rate limiting, bad email, network failure, cancelled OAuth and
  unavailable provider each map to actionable copy; a cancelled sheet is
  silent.
- **Security settings screen**: app-lock toggle, biometrics toggle, change PIN;
  and sign-out, which clears the session, the PIN, the lock settings and every
  in-memory store even if the network call fails.
- **`docs/AUTH_SETUP.md`**: every console step for Supabase (including the
  Magic Link template change that makes the email carry a code rather than a
  link), redirect URLs, the three Google OAuth clients, Apple's App ID /
  Services ID / key, plus a verification table and a troubleshooting section.
- **Tests** (+146, 434 total): the secure-store adapter, auth store, pure route
  guard, PIN hashing and attempt limits, lock policy, error classification,
  email/OTP validation, the resend timer, and router tests covering signed-out,
  onboarding, locked and signed-in states plus the OTP failure paths.

### Changed

- Native mocks for secure store, local authentication, screen capture, web
  browser and Apple authentication moved into `jest.setup.ts`, with a fake
  Supabase client in `src/test-utils/supabase-mock.ts`.
- The `(auth)` group replaced its Phase 1 placeholders (sign-in, sign-up,
  forgot-password) with the real welcome / email / verify flow.
- `app.json` gained the secure-store, web-browser, apple-authentication and
  local-authentication plugins, and `usesAppleSignIn`.

### Notes

- These native modules are not in Expo Go, so the preview scripts added last
  phase no longer run this app; a development build is required from here on.
- `.env.example` gained the three Google client IDs. They are public
  identifiers, not secrets; leaving one blank simply hides the Google button on
  that platform.

## [Phase 2] - 2026-09-19 - Database schema with RLS

### Added

- **Migrations** (`supabase/migrations/`), applied in order:
  - `20260919090000_initial_schema.sql` — the nine tables (`profiles`,
    `accounts`, `categories`, `recurring_rules`, `transactions`, `budgets`,
    `goals`, `goal_contributions`, `insights`), their CHECK constraints,
    foreign keys, indexes and the `set_updated_at()` trigger.
  - `20260919090100_row_level_security.sql` — RLS enabled _and forced_ on every
    table with select/insert/update policies scoped to `auth.uid()`, no DELETE
    policy, `REVOKE DELETE` from client roles, and no client INSERT on
    `profiles`.
  - `20260919090200_new_user_trigger.sql` — `handle_new_user()` creates the
    profile and seeds the 17 default Indian categories (idempotent).
  - `20260919090300_powersync_publication.sql` — the `powersync` publication
    over the nine synced tables, with `REPLICA IDENTITY DEFAULT`.
- **Schema conventions enforced in SQL**: client-supplied UUID PKs, integer
  paise as `bigint`, `user_id`/`created_at`/`updated_at`/`deleted_at` on every
  table, soft deletes only, `TEXT` + `CHECK` instead of Postgres enums (SQLite
  has no enum type, and PowerSync mirrors these tables into SQLite).
- **Cross-user integrity**: every child foreign key is composite,
  `(column, user_id) → parent (id, user_id)`, so a transaction cannot reference
  another user's account even if RLS were misconfigured.
- **pgTAP suites** (`supabase/tests/`), 111 assertions:
  - `01_rls.test.sql` (54) — user A cannot read, update, re-own or reference
    user B's rows; nobody can hard-delete; `anon` is refused outright; soft
    deletes work and stay visible to their owner for replication.
  - `02_schema.test.sql` (57) — the new-user trigger and seeded category set,
    amount/transfer/enum/month constraints, the `updated_at` trigger, indexes
    and the publication.
- **`scripts/db-test.sh`** — applies the migrations and runs the same pgTAP
  files against a plain local Postgres via a test-only Supabase auth shim
  (`supabase/tests/helpers/local_supabase_shim.sql`), so the suite runs without
  Docker.
- **`src/db/database.types.ts`** — generated from the live schema by
  `scripts/generate-database-types.mjs` (`npm run db:types`), plus
  `src/db/enums.ts` with the literal unions, type guards and shape helpers that
  the TEXT + CHECK columns need, all unit tested.
- **`docs/DATABASE.md`** — principles, a Mermaid ER diagram, a table-by-table
  reference, the RLS model, the new-user trigger, PowerSync setup (including
  the replication role that must be created outside version control) and the
  local workflow.
- npm scripts: `db:start`, `db:reset`, `db:test`, `db:test:local`, `db:types`.

### Notes

- `supabase start`, `supabase test db` and `supabase gen types` all require
  Docker, which was unavailable in this environment; the migrations and tests
  were therefore verified against a local Postgres 16 with the auth shim, and
  the types were generated from that same live schema. The Docker-based
  commands remain the canonical workflow.
- `profiles.user_id` duplicates `profiles.id` (with a CHECK keeping them equal)
  so every table — and therefore every RLS policy and PowerSync sync rule —
  keys off `user_id` uniformly.

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
