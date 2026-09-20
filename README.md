# FinPilot

Offline-first personal finance for Android and iOS. Built for Indian users —
INR by default, amounts stored as integer paise, and every screen usable with
no network.

> **Status:** Phase 11 — CI/CD, environments and monitoring.

## Stack

Expo SDK 57 (development builds) · TypeScript strict · Expo Router · Supabase ·
PowerSync · Zustand · Victory Native · Jest + React Native Testing Library ·
Maestro · Sentry · EAS.

## Prerequisites

- Node.js 20 or newer (this repo is developed on Node 22) and npm 10+
- A [Expo account](https://expo.dev) and the EAS CLI: `npm i -g eas-cli`
- **Android:** Android Studio + an emulator or a device with USB debugging
- **iOS:** macOS with Xcode 16+ (an iOS dev build cannot be produced on Linux
  or Windows)

FinPilot uses native modules, so it runs in a **development build** —
**Expo Go will not work.**

## Setup

```bash
git clone <this repo>
cd Finpilot
npm install
cp .env.example .env     # then fill in the three values
```

`.env` is git-ignored. Only `EXPO_PUBLIC_*` variables are readable from the
app; never put a service-role key or any other secret there.

| Variable                        | Where to find it                                   |
| ------------------------------- | -------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Supabase dashboard → Project Settings → API        |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API        |
| `EXPO_PUBLIC_POWERSYNC_URL`     | PowerSync dashboard → your instance → Instance URL |

## Running the app

Build and install the development build once per device or emulator:

```bash
npx eas login
npx eas build --profile development --platform android   # or ios
```

Install the resulting build, then start the dev server:

```bash
npm start
```

> **Expo Go no longer works.** Phase 3 added secure storage, local
> authentication and Apple sign-in, none of which Expo Go ships. Use a
> development build.

If you have the native toolchain locally you can skip EAS and build directly:

```bash
npm run android   # expo run:android
npm run ios       # expo run:ios (macOS only)
```

## Scripts

| Script                     | What it does                      |
| -------------------------- | --------------------------------- |
| `npm start`                | Metro bundler for the dev client  |
| `npm run android`          | Build + run the Android dev build |
| `npm run ios`              | Build + run the iOS dev build     |
| `npm run lint`             | ESLint                            |
| `npm run lint:fix`         | ESLint with `--fix`               |
| `npm run typecheck`        | `tsc --noEmit`                    |
| `npm test`                 | Jest                              |
| `npm run test:watch`       | Jest in watch mode                |
| `npm run test:coverage`    | Jest with the 80% floor enforced  |
| `npm run format`           | Prettier `--write`                |
| `npm run format:check`     | Prettier `--check`                |
| `npm run test:timezones`   | The period suite under four zones |
| `npm run db:test`          | pgTAP suite for the SQL schema    |
| `npm run db:types`         | Regenerate the database types     |
| `npm run build:preview`    | EAS preview build                 |
| `npm run build:production` | EAS production build              |
| `npm run update:preview`   | OTA update to the preview channel |

## Testing

| Level              | Where                             | Run it with              |
| ------------------ | --------------------------------- | ------------------------ |
| Unit and component | `src/**/__tests__`                | `npm test`               |
| Screen             | `app/__tests__`                   | `npm test`               |
| Coverage gate      | `src/features`, `src/utils`       | `npm run test:coverage`  |
| Timezones          | the period suite under four zones | `npm run test:timezones` |
| Database           | `supabase/tests`                  | `npm run db:test`        |
| End to end         | `.maestro/`                       | `maestro test .maestro/` |

`npm run test:coverage` **fails** below 80% statements, branches, functions and
lines for `src/features` and `src/utils` - the floor is enforced rather than
reported.

The end-to-end flows drive a real development build on a device; see
[.maestro/README.md](./.maestro/README.md). What to check by hand before a
release, and every case the suite is written against, is in
[docs/TEST_PLAN.md](./docs/TEST_PLAN.md).

## Environments and releases

Three variants install side by side, each with its own bundle id, name, deep
link scheme, EAS Update channel and Supabase project:

|             | Bundle id                      | Channel       | Supabase         |
| ----------- | ------------------------------ | ------------- | ---------------- |
| Development | `com.code4dk.finpilot.dev`     | `development` | Local or staging |
| Preview     | `com.code4dk.finpilot.preview` | `preview`     | Staging          |
| Production  | `com.code4dk.finpilot`         | `production`  | Production       |

A pull request runs the gate; a push to `main` builds a preview; a `v*` tag
builds production and submits a **draft** to both stores. Over-the-air
JavaScript updates are published by hand, on purpose.

The whole runbook - cutting a release, hotfixing with an OTA, rolling one
back, and what to watch in Sentry afterwards - is
[docs/RELEASE.md](./docs/RELEASE.md).

## Project structure

```
app/                  Expo Router routes (thin screens)
  (auth)/             Sign-in, sign-up, forgot-password
  (tabs)/             Home, Transactions, Add, Budgets, Reports
  settings/           Settings stack
  dev/                Development-only screens
src/components/       Shared presentational components
src/features/         Per-feature business logic and hooks
src/lib/              Env, Supabase client, Sentry, logging
src/db/               PowerSync schema and Supabase connector
src/theme/            Design tokens
src/stores/           Zustand stores
src/utils/            Pure helpers (money, ids, dates)
supabase/             SQL migrations and Edge Functions
docs/                 Changelog and design notes
```

## Authentication

Email OTP, Google and Apple sign-in, with an optional biometric/PIN app lock.
Every console step — Supabase settings, redirect URLs, Google's three OAuth
clients, Apple's App ID and key — is in
[docs/AUTH_SETUP.md](./docs/AUTH_SETUP.md).

## Offline-first sync

Every screen reads from local SQLite and every write lands there first;
PowerSync replicates when there is a network. The architecture, the upload
queue and the conflict strategy (last write wins by `updated_at`) are in
[docs/SYNC.md](./docs/SYNC.md).

## Database

Postgres on Supabase, replicated to devices by PowerSync. The schema, its RLS
policies and the local workflow are documented in
[docs/DATABASE.md](./docs/DATABASE.md).

```bash
npm run db:start   # local Supabase stack (needs Docker)
npm run db:reset   # apply every migration from scratch
npm run db:test    # pgTAP suite: RLS isolation + schema invariants
npm run db:types   # regenerate src/db/database.types.ts
```

## Component gallery

In a development build, open **Settings → Component gallery** (or navigate to
`/dev/components`) for a live catalogue of every component in both themes. The
route is guarded by `__DEV__` and cannot appear in a release build.

## Conventions

See [CLAUDE.md](./CLAUDE.md) for the full list. The load-bearing ones:

- Money is integer **paise**, never floats. Format only at display time.
- IDs are client-generated UUIDs (offline-first requirement).
- Synced tables carry `user_id`, `created_at`, `updated_at`, `deleted_at`;
  deletes are soft.
- Business logic lives in `src/features/*`; screens stay thin.
- Every util, hook and calculation gets unit tests.
- Every interactive element has an `accessibilityLabel`.

## Changelog

See [docs/CHANGELOG.md](./docs/CHANGELOG.md).
