# Changelog

All notable changes to FinPilot are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Phase 11] - 2026-09-20 - CI/CD, environments and monitoring

### Added

- **`app.config.ts` in place of `app.json`.** Development, preview and
  production now have their own bundle id, name and deep-link scheme, so all
  three install side by side on one device - which is what makes "does this
  reproduce on the preview build?" answerable in a minute. A static file
  cannot express that, which is why the config is now TypeScript.
- **Three EAS profiles** bound to three EAS environments: development
  (dev-client APK), preview (internal APK / TestFlight, **staging** Supabase)
  and production (app bundle, **production** Supabase). Build numbers
  increment remotely, so nothing in git has to be bumped to cut a build.
- **GitHub Actions**: a pull request runs lint, format, typecheck, the suite
  with the coverage floor, the timezone suite and the pgTAP suite against a
  real Postgres; a push to `main` waits for CI and starts a preview build; a
  `v*` tag re-runs the gate, builds production and submits a **draft** to
  both stores. Nothing releases itself - the tag is the decision, and a human
  presses publish.
- **EAS Update channels** with a `runtimeVersion` policy of `appVersion`: an
  over-the-air patch only reaches builds compiled against the same marketing
  version, so a JavaScript fix can go out in minutes while a native change
  still means a store release. Publishing is a manual workflow with a
  required reason, because an OTA skips review entirely.
- **Sentry** (`src/lib/monitoring.ts`), on for preview and production only.
  Every event is scrubbed before it is sent: amounts, balances, limits,
  notes, category and account names, emails, phone numbers and tokens are
  removed by key, and every string goes through the same redactor the local
  logger uses. The user is a bare UUID; screenshots and view hierarchies are
  off, because in this app a screenshot **is** the data. Reports are tagged
  with the environment, the update channel and the release, so "is this the
  build or the OTA?" is answerable from the issue page.
- **Splash screen and the app identity**: adaptive icon, monochrome icon, and
  a splash that uses the theme's own light and dark surfaces rather than
  flashing white before the app paints.
- **[docs/RELEASE.md](./RELEASE.md)**: the runbook - environments, cutting a
  release, what an OTA can and cannot fix, rolling one back, what to watch in
  Sentry for the first hour, and the pipeline's own failure modes.

### Fixed

- **Per-variant schemes would have broken Google sign-in on every build but
  production.** The OAuth redirect URI was built from a hardcoded `finpilot`
  scheme; with development on `finpilot-dev` and preview on
  `finpilot-preview`, the provider's redirect would have gone to whichever
  variant claimed the scheme, or to nothing at all. It now reads the scheme
  the build actually registered. Caught while making the variants installable
  side by side, and covered by a test.

### Changed

- The bundle id is now `com.code4dk.finpilot` rather than `com.finpilot.app`.
  **It cannot change after the first store submission**, so it is worth a
  deliberate decision now rather than a discovery later; the Maestro flows and
  the auth setup document were updated with it.

### Notes

- Staging and production are **separate Supabase projects**. A tester's entry
  must never reach a real ledger, and a migration has to be survivable before
  it is irreversible.
- The runtime version policy has a consequence worth knowing: bumping
  `version` in `app.config.ts` mid-cycle strands every installed build on an
  old runtime version and silently cuts them off from OTA patches. Bump it
  only when cutting a store release.

## [Phase 10] - 2026-09-19 - Test suite and QA

### Added

- **`npm run test:coverage`**, with the floor **enforced** rather than
  reported: the run fails below 80% statements, branches, functions and lines
  for `src/features` and `src/utils`. Both are now well clear of it -
  `src/features` at 93% / 86% / 93% / 94% and `src/utils` at 100% / 97% /
  100% / 100%.
- **+131 tests** aimed at what was untested rather than at the number: the
  auth API layer (a forgotten `throw`, an unnormalised email, a success with
  no session), the Google and Apple paths including every way a user can back
  out, biometrics, the onboarding store, the app-lock storage layer, the Add
  screen's hook, all three shared form screens, and the date utilities.
- **A cross-feature edge-case suite** (`src/features/__tests__/edge-cases.test.ts`)
  that runs the cases from the test plan rather than describing them: Indian
  digit grouping at lakh and crore, rounding half away from zero, the month
  and year boundaries, a monthly rule on the 31st through February, a yearly
  rule on 29 February, Devanagari and emoji through the CSV, formula
  injection, and a category that no longer exists.
- **Eleven Maestro flows** in `.maestro/`: onboarding, add expense, add
  transfer, edit, delete with undo, a budget crossed past 80%, a goal with a
  contribution, offline then sync, reports, CSV export and sign out - tagged
  `smoke` or `regression` so a release can run the short set first.
- **[docs/TEST_PLAN.md](./TEST_PLAN.md)**: 28 functional cases, 10
  offline/sync cases, 23 edge cases and 6 accessibility cases, each with
  steps, expected result and priority - plus the release regression checklist
  and what it takes to sign off.
- `renderHookWithDatabase` in `src/test-utils/render.tsx`, so a hook that
  watches a query can be tested against the real `useQuery` rather than a
  mock of it.

### Fixed

- **The trend chart silently disagreed with the figures above it.** A custom
  range longer than 24 months was truncated to the **oldest** 24, so a
  three-year report drew bars ending in 2024 while the totals, the donut and
  the daily average covered 2026. The chart now keeps the most **recent**
  months and says so on screen when it has trimmed.
- **The suite was flaky under `--coverage`.** The first instrumented run
  failed 18 tests across 3 suites and the next passed: instrumentation slows
  every render past React Native Testing Library's one-second default wait.
  Raised `asyncUtilTimeout` and `testTimeout`; three consecutive coverage runs
  are now clean.
- **`signInWithGoogle` could not be tested at all.** `EXPO_PUBLIC_*` variables
  are inlined by the bundler rather than read at runtime, so no test could
  give it a client id. It now takes one as an argument, defaulted from the
  environment - the same seam the API layer uses for its Supabase client.

### Notes

- Coverage is a floor, not a goal. A line can be covered by a test that
  asserts nothing, which is why the new tests are written against behaviour -
  what reaches the database, what is refused, what a screen reader hears - and
  why the thresholds are per directory: a single global number lets a
  well-tested util subsidise an untested feature while the risk sits exactly
  where it always did.
- The offline flow toggles the radio through `adb`, so it is Android-only as
  written. Offline is the premise of this app rather than a corner of it, so
  the iOS equivalent is on the manual release checklist instead of being
  quietly skipped.

## [Phase 9] - 2026-09-19 - Settings, account deletion and hardening

### Added

- **Settings, rebuilt around three groups** - your money, the app, your data -
  with a profile screen (name, read-only email, and why INR is not a dropdown),
  a notifications screen, a lock timeout, an export screen and a delete-account
  route.
- **Preferences that survive a restart.** Theme, privacy mode and the alert
  toggle were in memory only, so every relaunch forgot them. They are now in
  AsyncStorage - preferences are not credentials, so they do not belong in the
  keychain with the session and the PIN - read back once at launch, narrowed on
  read, and wiped from disk on sign-out.
- **A configurable app-lock timeout**: immediately, 1, 5 or 15 minutes, with a
  stored value that is only honoured if it is one of those.
- **`delete-account` Edge Function** - the one hard delete in FinPilot, and
  what both app stores require. Verifies the JWT, requires the word `DELETE`,
  deletes children before parents and the auth user last, so a failure part-way
  leaves the user able to sign in and try again. The screen makes them type the
  word and offers an export first.
- **Export everything**: one JSON archive of all nine tables, read from the
  local database so it works offline, with the amounts labelled as integer
  paise for whoever opens it in three years.
- **Privacy policy and terms**, the app version and the build number on About -
  opened through a guard that allows `https:` and nothing else.
- **A redacting logger** (`src/lib/logger.ts`). Every log line is scrubbed of
  JWTs, credentials, emails, phone numbers, anything named like money and any
  long run of digits, then truncated. There is no `info` or `debug` level on
  purpose.
- **Developer tools**: a seed screen that writes 10,000 transactions - three
  years of a plausible ledger - from a deterministic generator, so performance
  can be judged at a size a real user reaches.

### Fixed

- **The PIN lockout reset on force-quit.** The failed-attempt counter lived in
  memory, so five wrong guesses, a force-quit and five more would eventually
  reach a four-digit PIN. It now persists in secure storage, is clamped on
  read, and is cleared on a successful unlock.
- **Sync failures wrote the user's amounts into the device log.** PostgREST
  quotes the offending values back - `(amount_paise)=(500000)` - and that went
  straight to `console.warn`. Now redacted.
- **A long amount crashed the Add screen.** `parseAmountToPaise` had no upper
  bound, so holding a digit key reached a value that made `assertPaise` throw
  from inside a keystroke handler. It now returns `null` past
  `MAX_AMOUNT_RUPEES`, like every other invalid input.
- **The transactions list pulled every row into JavaScript**, mapped it and
  grouped it on every keystroke. It now pages 200 rows at a time and grows on
  scroll.

### Changed

- The categories list renders through FlashList with a hoisted `renderItem`,
  so a long tail of custom categories recycles rows instead of re-rendering the
  window.
- Budget alerts moved from the Settings root to the notifications screen; the
  permission prompt still happens there, when the user asks for alerts.

### Tests

+118, 1256 total, plus 22 new pgTAP assertions.

- **An accessibility audit that walks every screen** on every run: each asserts
  that every interactive element has a label, that every measurable target is
  at least 44pt, and that nothing turns OS font scaling off. What it cannot
  check is whether a label _reads_ well - that still needs a person and a real
  screen reader.
- **A performance budget at 10,000 transactions**: grouping a page, grouping
  the whole ledger (the guard against an accidental quadratic), period totals
  and account balances, each with a ceiling.
- Redaction against the exact PostgREST error shape; profile validation
  including control and zero-width characters; the export archive; the delete
  confirmation; preference persistence including a corrupt record; the
  persisted lockout.

### Notes

- Findings and fixes are written up in
  [docs/SECURITY_REVIEW.md](./SECURITY_REVIEW.md) - seven findings, all fixed
  here, each now covered by a test so a regression fails the suite rather than
  waiting for the next review.
- Screenshot protection stays tied to the app lock rather than being always on.
  Setting `FLAG_SECURE` unconditionally breaks legitimate screenshots and
  screen sharing for everyone, to defend against an attacker who already has
  the unlocked device. Written down as a decision, not left as an oversight.

## [Phase 8] - 2026-09-19 - AI insights via edge function

### Added

- **`generate-insights` Edge Function** (Deno, TypeScript): verifies the
  caller's JWT, checks `profiles.ai_insights_opt_in` server-side, rate-limits
  to 5 generations per user per day, builds an aggregated payload, calls
  `claude-opus-5` with structured outputs, validates the answer with zod and
  stores it in `insights`. The checks run in that order, so a caller who fails
  any of them costs nothing and reads nothing.
- **A payload that carries aggregates and category names, and nothing else.**
  No notes, no account names, no ids, no email, no individual transactions.
  Goal names never leave the device either: the model sees `goal_1` and the
  function substitutes the real name back into the answer before storing it.
- **`ai_insight_requests`**: one row per call, succeeded or not - the rate
  limit counts attempts, because a failing call still costs a call to the
  model. Server-side only: RLS enabled with no policies, every privilege
  revoked from client roles, not in the PowerSync publication.
- **`ai_insight_aggregates(user_id, month)`**: a `SECURITY DEFINER` function,
  executable only by the service role, that is the one statement the function
  runs against a user's data.
- **Insights card on Home and a full Insights screen**, with a month selector,
  loading, error and offline states, and the cached last result shown
  instantly - it is an ordinary synced row.
- **A consent screen** listing, in plain words, exactly what is sent and what
  never is. The list is the literal contents of the payload builder, not a
  paraphrase of a policy.
- **Rule-based insights computed on the device** as the fallback when offline,
  not opted in, or out of generations: totals against last month, the largest
  category, the daily pace and where it lands, categories materially up,
  budgets over or pacing over, and what a goal still needs.
- **Tests** (+59, 1121 total): the payload builder fed rows carrying notes,
  account names, goal names and an email, asserting none of it survives - and
  every key at every depth checked against an allow-list; the zod validation of
  malformed, oversized and hostile responses; the fallback rules including the
  two thresholds that stop it manufacturing a trend. Plus 23 new pgTAP
  assertions covering the log's lockdown and what the aggregation may read.

### Notes

- **Category names are the one deliberate exception** to "no free text". They
  are the analysis - "you spent more on Food" is not sayable without the word
  Food - and the seventeen defaults are generic, but a custom category name is
  text a user typed. That trade-off is stated on the consent screen in those
  terms rather than buried.
- The app always says which kind of insight is on screen: an `AI` or
  `On device` badge. A sentence written by a model and a sentence computed
  from arithmetic deserve different amounts of trust, and that is the user's
  call.
- A validation failure is recorded with **issue paths only** - never the
  model's text, which carries the user's figures - and the app falls back to
  the on-device rules rather than rendering something half-valid.
- `ANTHROPIC_API_KEY` lives in Supabase secrets. Only `EXPO_PUBLIC_*`
  variables reach the client, and a key in an app bundle is a published key.
- The Edge Function is excluded from the app's `tsconfig.json` - it is Deno.
  `payload.ts` and `schema.ts` import nothing from Deno precisely so the app's
  Jest suite can import and test them.

## [Phase 7] - 2026-09-19 - Reports, charts and CSV export

### Added

- **Report aggregation as SQL over the local database**
  (`src/features/reports/queries.ts`): period totals, spend per category,
  income and expense per month, this period against the one before it per
  category, the largest expenses, and the export rows with names joined on.
  Nothing is computed server-side and nothing is fetched, so the whole tab
  works offline. The builders return `{ sql, parameters }` like the
  repositories do, so the hooks hand them to PowerSync's `useQuery` and the
  screen re-renders the moment a transaction changes.
- **Period selector**: this month, last month, 3, 6 or 12 months, and a custom
  range picked as two dates. The trailing presets are whole calendar months
  ending with the current one, so the trend chart has clean buckets.
- **Spending by category**: a Victory Native (Skia) donut with the ranked list
  beside it - amount, share and entry count per category. Tapping a category
  opens its transactions for the same period at
  `/reports/category/[id]`, with the window carried in the URL so back and
  deep links both behave.
- **Income against expense**: a grouped bar chart, one pair per month, with a
  legend and month labels as ordinary text below the canvas.
- **Month-over-month change per category**, with a direction arrow that is
  always accompanied by the percentage, and a "new" state instead of an
  infinite percentage for a category with nothing behind it.
- **Top 5 expenses and daily average spend.** The average divides by the days
  the period has actually seen, so a month in progress reads honestly instead
  of dividing a part-month by 30.
- **CSV export** (expo-file-system + expo-sharing) for the chosen period:
  UTF-8 with a BOM, CRLF rows, amounts as plain rupees with two decimals and a
  signed column for pivots, and fields that could be read as a formula
  neutralised - a note reading `=cmd|...` is a real attack on whoever opens
  the file.
- **Chart colours** (`src/theme/chart-colors.ts`), validated against the app's
  actual surfaces for colour-vision deficiency rather than chosen by eye.
- **Tests** (+78, 1062 total): the SQL runs against a real in-memory SQLite,
  so the aggregation is proved rather than asserted as a string - including
  that transfers, soft-deleted rows and other users never reach a total. Plus
  period resolution across year boundaries and DST, slice folding, change
  direction, the accessible summaries, and every CSV escaping rule.

### Notes

- The trend bars are blue and orange, **not** the app's income green and
  expense red. That pair scores a CVD colour distance of 4.2 under
  deuteranopia - far below the floor of 8 - so a red-green viewer would see
  two identical bars. Blue and orange score 24.7. The green and red stay on
  amounts, where the sign carries the meaning too.
- Past eight categories everything folds into one grey "Other" rather than
  cycling the palette: two slices wearing the same colour is worse than one
  honest remainder.
- Monthly buckets are a UNION of per-month aggregates rather than a `GROUP BY
strftime(...)`, because `occurred_at` is a UTC instant and the buckets must
  be local months. It also means a month with no transactions draws a zero bar
  instead of disappearing off the axis.
- Each chart is a single accessibility node carrying a spoken summary of the
  data - a Skia canvas tells a screen reader nothing, and announcing the
  individual slices would read out a list of shapes.

## [Phase 6] - 2026-09-19 - Budgets, alerts and savings goals

### Added

- **Budget maths** (`src/features/budgets/budget-math.ts`): spent against
  limit, the green/amber/red bands defined once in `toneFor`, days left in the
  month (counting today, so it is never 0 and the daily division cannot blow
  up), safe-to-spend-per-day, spending pace, and a whole-month summary.
- **Budgets tab**: a ring with the month's percentage, days left and safe per
  day, then a bar per category with its percentage, limit and pace. The
  percentage appears next to every bar and in its accessibility label - colour
  is never the only signal.
- **Copy last month's budgets** (`BudgetsRepository.copyFrom`): skips
  categories already budgeted in the target month, so running it twice adds
  nothing and an adjusted budget is never overwritten. Copies start with clear
  alert flags.
- **Budget alerts** via expo-notifications, fired once per budget per threshold
  per month. The `alert_80_sent` / `alert_100_sent` columns are what enforce
  that, and because they sync, a second device stays quiet too. A budget that
  jumps straight past both bands announces only the 100% crossing. Flags are
  written **after** delivery, so a revoked permission does not silently burn
  the one alert a budget gets. Raising a limit clears them.
- **Permission asked in context** - when the user turns alerts on in Settings,
  never at launch. If the OS has stopped asking, the copy points at phone
  settings rather than pretending the toggle will work.
- **Goals**: create (name, target, optional date, icon), add contributions
  optionally attributed to an account, a progress ring, the required monthly
  saving to hit the date, a projected completion from the rate so far, and a
  celebration on the transition into completeness that also writes the status
  back.
- **Tests** (+130, 984 total): the tone bands at their exact boundaries, days
  left across month lengths and leap years, safe-per-day including the
  last-day and over-budget cases, alert thresholds including the
  jumped-past-both case and the no-repeat guarantee, the permission state
  machine, copy-forward idempotency, and goal projections including the
  honest nulls.

### Notes

- Required monthly saving is arithmetic; projected completion is a guess from
  the contribution rate and is labelled as one. With no contributions the
  projection is **null** rather than a fabricated date - the screen says "add a
  contribution to see your pace".
- The average contribution rate is measured from the first contribution, not
  from when the goal was created: a goal made in January and first funded in
  June has a six-month history, not a one-month one.

## [Unreleased]

### Fixed

- The Budgets and Reports tabs still rendered hardcoded sample figures from
  Phase 1. With every other screen now showing real data, those numbers were
  actively misleading - budget bars for budgets the user never created, and a
  "net this month" unrelated to their money. Both now read from the local
  database through the existing Phase 4 hooks, with honest empty states when
  there is nothing to show. Creating and editing budgets is still to come; the
  Reports screen says plainly that the charts are, while its numbers are live.

## [Phase 5] - 2026-09-19 - Accounts, transactions and recurring entries

### Added

- **Ledger logic** (`src/features/ledger/`), pure and tested: account
  balances, net worth (assets and liabilities separated), period totals, and
  day grouping with per-day totals flattened for a virtual list. A transfer
  moves money between two accounts and nets to zero across them, so it counts
  in neither income nor expense.
- **Period boundaries** (`period.ts`): local day and month windows expressed as
  half-open UTC ranges, so a month filter is `[1st, next 1st)` with no gap or
  overlap. `npm run test:timezones` runs the suite under IST, UTC, New York and
  Chatham, including both DST transitions.
- **Recurring schedule** (`recurring/schedule.ts`): an **anchor day** keeps a
  monthly rule from drifting - 31 Jan → 28 Feb → **31** Mar, not 3 Mar and then
  the 3rd forever. Yearly rules on 29 February clamp to the 28th and return to
  the 29th at the next leap year.
- **Deterministic generation** (`recurring/generate.ts`): an occurrence's id is
  `uuidv5(ruleId + ':' + occurrenceISO)`, so two offline devices generating the
  same occurrence produce byte-identical rows and the upload converges to one.
  Catch-up runs on launch and on foreground, capped at 200 occurrences so a
  long-abandoned rule cannot hang the launch, and retires a rule past its end
  date.
- **Add screen**: type toggle, large amount input, category grid ordered
  recently-used-first, account picker, date/time defaulting to now, note and
  Repeat. The design target - an expense saved in **two taps** after the amount
  is typed - is expressed as `remainingTapsToSave` and asserted in tests rather
  than claimed.
- **Transactions list**: FlashList grouped by day with daily totals, search by
  note, filters (date range, type, account, category), and swipe to edit or
  delete with an **Undo** toast that re-inserts the row under its original id.
- **Accounts**: list with live balances and a net-worth card, detail with the
  account's transactions, add/edit, and archive (never delete - history keeps
  its account).
- **Categories**: add, edit and archive. Seeded defaults can be renamed or
  archived but never deleted, and the refusal explains why and offers archiving.
- **Recurring management**: list with pause/resume and delete, which keeps the
  transactions already generated.
- **Home**: net worth, this month's income and spend, the last five
  transactions and a quick add - all reading from the local database.
- **Components**: `SegmentedControl`, `CategoryGrid`, `SwipeRow`,
  `TransactionRow`, and a toast that can carry a single action (Undo).
- **Tests** (+245, 845 total): balances including transfers and deletes, period
  and DST boundaries, month-end recurrence across a full year, deterministic
  id stability, the draft state machine and tap budget, category ordering and
  the delete rules, the generation runner, and screen tests covering the list,
  the two-tap path, swipe actions and Undo.

### Changed

- The home and transactions screens now read real data instead of the Phase 1
  placeholders.
- `CategoryIcon` accepts a glyph name, which is what `categories.icon` stores.
- Jest mocks `react-native-gesture-handler/ReanimatedSwipeable`: Reanimated's
  own mock imports the real library, which needs the native worklets module.
  The gesture is not unit-testable either way; the mock renders the row and its
  actions so both stay covered.
- The test double for PowerSync now implements the watched-query contract
  (`customQuery().watch()`, `updateSettings`, listeners), so screen tests
  exercise the same reactive path the app uses.

### Notes

- Conflict resolution stays per row (Phase 4): two edits to different fields of
  the same transaction still means one is lost.
- Day grouping uses the **device** timezone, not `profiles.timezone`. Hermes on
  Android ships a trimmed ICU, so an arbitrary `timeZone` cannot be relied on
  for the grouping path on device - a suite that passed in Node would be wrong
  on a phone. Correct for a user at home; wrong for one who travels and expects
  home-time grouping.

## [Phase 4] - 2026-09-19 - Offline-first sync with PowerSync

### Added

- **PowerSync SDK** (`@powersync/react-native` 2.2.1 on `@op-engineering/op-sqlite`,
  which is the adapter that line of the SDK now peers).
- **Local schema** (`src/db/schema.ts`) mirroring all nine synced tables, with
  money as INTEGER paise, booleans as 0/1 and timestamps as TEXT, plus indexes
  matching the hot Postgres ones. `src/db/row-mappers.ts` is the single place
  that translates those representations.
- **Sync rules** (`powersync/sync-rules.yaml`): one bucket per user, filtered
  on `request.user_id()` and `deleted_at IS NULL` — so a soft delete moves the
  row out of the bucket and PowerSync removes it from every device, without a
  hard delete ever happening server-side.
- **Supabase connector** (`src/db/connector.ts`): `fetchCredentials` from the
  live session (null when signed out, so PowerSync stays disconnected rather
  than syncing anonymously); `uploadData` mapping PUT → upsert, PATCH → update
  and DELETE → a `deleted_at` stamp.
- **Upload failure triage** (`src/db/upload-errors.ts`): transient failures are
  rethrown for PowerSync to retry; permanent ones (SQLSTATE 22/23/42xxx, HTTP
  4xx) are logged and discarded so one rejected row cannot block the ordered
  queue forever. Anything unrecognised counts as transient — discarding a write
  we do not understand would lose the user's data.
- **Repositories** (`src/db/repositories/*`) for all nine tables: reads build
  SQL that hooks hand to `useQuery`, writes are local-first with a client UUID
  and a client `updated_at`. Account balances, budget progress and goal totals
  are single queries rather than N+1.
- **Hooks** (`src/db/hooks.ts`): `useAccounts`, `useCategories`,
  `useTransactions(filters)`, `useBudgetProgress`, `useGoals`, `useProfile`,
  `useSyncSummary`, and repository accessors for writes.
- **Sync status**: `synced | syncing | offline | error` derived in
  `src/db/sync-status.ts`, shown in the home header as an icon-plus-colour
  indicator with a detail sheet that explains what each state means for the
  user's data.
- **Lifecycle**: connect on sign-in, disconnect when the session goes (without
  clearing — a token blip must not discard offline work), and
  `disconnectAndClear` on explicit sign-out.
- **Conflict resolution migration** (`20260919100000_last_write_wins.sql`):
  `set_updated_at` now honours a client-supplied `updated_at`, skips a write
  whose timestamp is older than the stored row, and clamps a fast client clock
  to `now() + 5 minutes`.
- **Tests** (+166, 600 total; SQL +16, 127 total): repositories against a
  mocked database, connector upload translation and error triage, status
  mapping, row mappers, and a parity test asserting the generated Postgres
  types, the local schema, the sync rules and the publication all describe the
  same tables and columns. `03_conflict_resolution.test.sql` proves a stale
  write loses whole — including a stale delete against a newer edit.
- **`docs/SYNC.md`**: architecture, type translation, bucket design, the upload
  queue and its triage, the conflict strategy and what it does _not_ give you,
  status states, lifecycle and setup steps.

### Changed

- `set_updated_at()` no longer stamps `now()` unconditionally. Without this,
  "last write wins by `updated_at`" was really "last write to reach the server
  wins", and a device returning from an hour offline would clobber newer edits.
- Jest now transforms `.mjs` dependencies (PowerSync ships one) and mocks
  op-sqlite and the database instance, since a native SQLite engine cannot load
  under Jest.

### Notes

- Conflict resolution is per row, not per column: two edits to different fields
  of the same row still means one is lost. For one person with a phone and a
  tablet that is the right trade; concurrent editors would need per-field
  timestamps or CRDTs.
- The sync rules file is version-controlled here but must be **deployed from
  the PowerSync dashboard** — editing it in the repo changes nothing.
- op-sqlite is a native module, so a fresh development build is required.

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
