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
src/
  components/         Shared, presentational components.
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
```

## Conventions

- **Money is always integer paise.** Never floats — not in state, storage or
  arithmetic. Convert at the edges with `rupeesToPaise` / `parseAmountToPaise`
  and format only at display time with `formatPaise` (`src/utils/money.ts`).
- **All IDs are UUIDs generated on the client** (`createId()` in
  `src/utils/id.ts`). Offline rows cannot wait for a server-assigned id.
- **Every synced table has `user_id`, `created_at`, `updated_at`,
  `deleted_at`.** Deletes are soft: set `deleted_at`, never remove the row.
- **Business logic lives in `src/features/*`;** screen files under `app/` stay
  thin and only compose components and feature hooks.
- **No secrets in the app bundle.** Only `EXPO_PUBLIC_*` variables reach the
  client. Anything privileged belongs in a Supabase Edge Function.
- **Every new util, hook and calculation gets unit tests.**
- **Every interactive element has an `accessibilityLabel`** (and an appropriate
  `accessibilityRole`).

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
