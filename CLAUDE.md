# CLAUDE.md — FinPilot

Guidance for Claude Code (and any engineer) working in this repository.

## Project overview

FinPilot is a personal finance app for Android and iOS, built for Indian users.
Default currency is INR. It is **offline-first**: every screen must work with no
network, and data syncs to the server when connectivity returns.

## Stack

| Concern         | Choice                                            |
| --------------- | ------------------------------------------------- |
| App framework   | Expo SDK 57 (development builds, **not** Expo Go) |
| Language        | TypeScript, `strict: true`                        |
| Navigation      | Expo Router (file-based, typed routes)            |
| Backend         | Supabase (Postgres, Auth, Edge Functions)         |
| Offline sync    | PowerSync (SQLite ↔ Supabase)                     |
| State           | Zustand                                           |
| Charts          | Victory Native (Skia)                             |
| Unit tests      | Jest (`jest-expo`) + React Native Testing Library |
| E2E             | Maestro                                           |
| Monitoring      | Sentry                                            |
| Build / release | EAS Build, Submit, Update                         |

Native modules are in play, so the app runs in a **development build**
(`expo-dev-client`). Expo Go is not supported.

## Folder structure

```
app/                  Expo Router routes. Thin screens only.
  (auth)/             Sign-in, sign-up, forgot-password.
  (tabs)/             Home, Transactions, Add (centre button), Budgets, Reports.
  settings/           Settings stack.
  dev/                Development-only screens (__DEV__ guarded).
src/
  components/         Shared, presentational components.
  test-utils/         Test render helpers (theme + safe area + toast).
  features/<feature>/ Business logic, hooks and feature components.
  lib/                Cross-cutting infrastructure (env, Supabase, Sentry).
  db/                 PowerSync schema, client and Supabase connector.
  theme/              Colors, spacing, typography tokens.
  stores/             Zustand stores.
  utils/              Pure helpers (money, ids, dates).
supabase/             SQL migrations and Edge Functions.
docs/                 CHANGELOG and design notes.
```

## Commands

```bash
npm start            # Metro for the dev client
npm run android      # build + run the Android dev build
npm run ios          # build + run the iOS dev build (macOS only)
npm run lint         # ESLint
npm run lint:fix     # ESLint with --fix
npm run typecheck    # tsc --noEmit
npm test             # Jest
npm run test:watch   # Jest in watch mode
npm run format       # Prettier --write
npm run format:check # Prettier --check

npm run db:start     # supabase start (local stack, needs Docker)
npm run db:reset     # re-apply every migration
npm run db:test      # pgTAP suite (works without Docker - see docs/DATABASE.md)
npm run db:types     # regenerate src/db/database.types.ts
```

## Conventions

- **Money is always integer paise.** Never floats — not in state, storage or
  arithmetic. Convert at the edges with `rupeesToPaise` / `parseAmountToPaise`
  and format only at display time with `formatPaise` (`src/utils/money.ts`).
- **All IDs are UUIDs generated on the client** (`createId()` in
  `src/utils/id.ts`). Offline rows cannot wait for a server-assigned id.
- **Every synced table has `user_id`, `created_at`, `updated_at`,
  `deleted_at`.** Deletes are soft: set `deleted_at`, never remove the row.
  The database enforces this: there is no DELETE policy and the privilege is
  revoked from client roles. RLS is enabled _and forced_ on every table, and
  child rows use composite foreign keys `(column, user_id)` so a row can never
  reference another user's data. Schema changes go in a new migration under
  `supabase/migrations/`, with pgTAP coverage in `supabase/tests/` — see
  [docs/DATABASE.md](./docs/DATABASE.md).
- **`src/db/database.types.ts` is generated** (`npm run db:types`); never edit
  it. Enumerations are TEXT + CHECK in the database, so narrow `string`
  columns through the unions and guards in `src/db/enums.ts`.
- **Business logic lives in `src/features/*`;** screen files under `app/` stay
  thin and only compose components and feature hooks.
- **No secrets in the app bundle.** Only `EXPO_PUBLIC_*` variables reach the
  client. Anything privileged belongs in a Supabase Edge Function.
- **Every new util, hook and calculation gets unit tests.**
- **Every interactive element has an `accessibilityLabel`** (and an appropriate
  `accessibilityRole`), a **44pt minimum touch target** (directly or via
  `hitSlop`), and allows OS font scaling — cap it with
  `maxFontSizeMultiplier={theme.fontScaleCaps.control}` on dense controls
  rather than setting `allowFontScaling={false}`.
- **Colours come from the theme, never from a raw hex.** Read them with
  `useTheme()` / `useColors()`. Any new token pair must clear WCAG AA in both
  schemes — `src/theme/__tests__/contrast.test.ts` enforces this.

Component library: everything in `src/components` is exported from
`@/components`. Render components in tests with `renderWithTheme` from
`@/test-utils/render` (RNTL v14 — `render`, `fireEvent` and `renderRouter` are
all **async**, so `await` them). The live catalogue is `/dev/components`,
reachable from Settings in a development build.

Additional house style: import shared code through the `@/` alias (`@/utils/money`),
prefer named exports outside of `app/` routes, and keep modules kebab-cased.

## Phase Completion Checklist

At the end of every phase:

a) Run `npm run lint`, `npm run typecheck` and `npm test`; fix until all pass.
b) Add an entry to `docs/CHANGELOG.md` describing what was built.
c) `git add -A`, commit using Conventional Commits with the message given in the
phase prompt, and create the git tag `phase-N`.
d) Print a short summary: what was built, how to test it manually, and any
manual setup steps the user must do.
