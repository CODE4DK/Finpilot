# Security review — Phase 9

A pass over the whole app against the six things that actually matter for a
finance app on a phone: secrets, logs, credential storage, the app switcher,
input validation, and row-level security. Each section says what was checked,
how, and what was wrong.

Seven findings. All seven are fixed in this phase; nothing is deferred.

| ID     | Severity | Finding                                                        | Status     |
| ------ | -------- | -------------------------------------------------------------- | ---------- |
| SEC-01 | Medium   | PIN lockout reset on force-quit                                | Fixed      |
| SEC-02 | Medium   | Upload errors wrote row values to the device log               | Fixed      |
| SEC-03 | Medium   | A long amount crashed the input rather than failing validation | Fixed      |
| SEC-04 | Low      | Background lock timeout was fixed, and unvalidated on read     | Fixed      |
| SEC-05 | Low      | No in-app account deletion                                     | Fixed      |
| SEC-06 | Low      | No guard on which URLs the app may open                        | Fixed      |
| SEC-07 | Info     | Screenshot protection is tied to the app lock                  | Documented |

---

## SEC-01 — The PIN lockout reset on force-quit (Medium)

**Found by** reading `useAppLockStore` against `MAX_PIN_ATTEMPTS`.

`failedAttempts` lived only in the Zustand store, so it went back to zero every
time the process died. Five wrong guesses, force-quit, five more — a four-digit
PIN has ten thousand possibilities, and this made the "five attempts" limit
decorative for anyone holding the device.

**Fix.** The counter is persisted in secure storage beside the PIN
(`finpilot.app-lock.attempts`), hydrated at launch, clamped to the maximum on
read, and cleared on a successful unlock and by every path that clears the PIN.
`src/features/app-lock/__tests__/lock-policy.test.ts` covers all four.

## SEC-02 — Upload errors wrote row values to the device log (Medium)

**Found by** grepping every `console.*` call and reading what each interpolates.

`SupabaseConnector`'s discarded-upload handler wrote the PostgREST error
straight to `console.warn`. Postgres quotes the offending values back at you —
`duplicate key value violates unique constraint (amount_paise)=(500000)` — so a
failed sync put the user's amounts into `adb logcat`, where any app with
`READ_LOGS` on an older Android, or anyone with the device and a cable, can
read them.

**Fix.** `src/lib/logger.ts`: a `redact` pass over every line that strips JWTs,
labelled credentials, emails, Indian mobile numbers, anything named like money,
rupee figures, and any run of seven or more digits — then truncates at 500
characters so nobody dumps a row by accident. Every `console` call in the app
now goes through it, and there is no `info` or `debug` level on purpose: a
level nobody reads in production is a level that accumulates whatever is
convenient, and what is convenient is the row. Thirteen tests, including the
exact PostgREST error shape above.

## SEC-03 — A long amount crashed the input (Medium)

**Found by** fuzzing `parseAmountToPaise` with the inputs a keyboard can
actually produce.

`parseAmountToPaise` had no upper bound. Holding a digit key reaches 1e20 in a
couple of seconds; `rupeesToPaise` then called `assertPaise`, which **throws**
`MoneyError` — from inside a keystroke handler, so the Add screen went down
rather than showing a validation message. Not exploitable by anyone but the
user themselves, but a crash in the one screen the app exists for.

**Fix.** `MAX_AMOUNT_RUPEES` (`MAX_SAFE_INTEGER` paise, about ninety thousand
crore) is now the documented ceiling, and anything past it returns `null` like
every other invalid input. A rejected amount is a validation message; a thrown
one is a crash.

## SEC-04 — Lock timeout was fixed and unvalidated (Low)

The background grace period was a hardcoded 60 seconds with no way to change
it, and `readAppLockSettings` merged whatever was in storage over the defaults
without checking it. A corrupted record — or a value written by a future build
— could have produced an arbitrarily long unlocked window.

**Fix.** The timeout is a user setting (Immediately / 1 / 5 / 15 minutes), and
`narrowTimeout` refuses any value that is not one of the offered options,
falling back to one minute. A stored number can no longer widen the window past
what a user chose.

## SEC-05 — No in-app account deletion (Low)

Both app stores require an in-app route to delete the account and its data.
There wasn't one — which is a rejection at review, and the wrong answer to a
user who wants out.

**Fix.** `supabase/functions/delete-account/`: verifies the caller's JWT,
requires the literal word `DELETE` in the body, then deletes children before
parents, the profile, and the auth user last — so a failure part-way leaves the
user able to sign in and try again rather than stranded with an account they
cannot reach. The screen makes them type the word, offers an export first, and
calls `signOutEverywhere` afterwards so the device is left with nothing on it.
Ten pgTAP assertions cover the delete order, that a client still cannot
hard-delete anything, that the other user is untouched, and that the auth-user
cascade catches anything the function missed.

## SEC-06 — No guard on which URLs the app may open (Low)

The About screen opens the privacy policy and terms in a browser. Both are
constants, so nothing was wrong today — but nothing stopped a URL from a synced
row or a deep link reaching the same opener tomorrow, and `javascript:` and
`file:` URLs are the reason that matters.

**Fix.** `isSafeExternalUrl` allows `https:` and nothing else; every external
link goes through it. Tested against `http:`, `javascript:`, `file:` and
malformed input.

## SEC-07 — Screenshot protection is tied to the app lock (Informational)

`FLAG_SECURE` is set on Android, and the iOS privacy cover is drawn, only while
the app lock is **enabled**. A user who has not turned the lock on can
screenshot their own balances, and so can anything with screen-record
permission.

This is deliberate, and stays. Setting `FLAG_SECURE` unconditionally breaks
legitimate screenshots and screen sharing for every user in order to protect
against an attacker who already has the unlocked device. The lock is the
control; the flag follows it. It is written down here so the next person
reading the code knows it is a decision rather than an oversight.

---

## What was checked and found clean

### No secrets in the bundle

`src/lib/env.ts` is an allowlist of three `EXPO_PUBLIC_*` variables and throws
on anything missing; there is no other `process.env` read in the app.
`ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` appear only inside
`supabase/functions/`, which runs on Deno and never ships in a build. `.env` is
git-ignored, `.env.example` is not.

Anything privileged — generating an insight, deleting an account — is an Edge
Function for exactly this reason.

### Tokens only in secure storage

| What                                 | Where                                                 | Why                             |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------- |
| Supabase session                     | keychain / keystore, via `createSecureStorage`        | a session is a credential       |
| App-lock PIN (salted, iterated hash) | keychain / keystore, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | never travels in a backup       |
| Failed-attempt counter               | same                                                  | SEC-01                          |
| Theme, privacy mode, alert toggle    | AsyncStorage                                          | preferences are not credentials |

`secure-store-adapter.ts` chunks values past the platform's item-size limit,
because a Supabase session with a long JWT exceeds it and a silently truncated
session is a sign-out at the worst moment.

The PIN is a salted, 2,000-round SHA-256 chain with a constant-time-ish
comparison — and `src/features/app-lock/pin.ts` is honest in its own comment
that no hash saves a 4-digit PIN from an offline sweep. The real protections
are the keychain and the lockout, which is why SEC-01 mattered.

### App-switcher protection

`shouldHideContent` covers iOS's brief `inactive` state as well as `background`
— the switcher screenshots the last frame as it opens, so waiting for
`background` is too late. Android draws recents from the live window, so
`FLAG_SECURE` via `expo-screen-capture` is what blanks it there. Both are
wired in `AuthGate`, above every screen.

### Input validation on every form

Every form validates before it writes, and every bound matches the database
CHECK constraint behind it, so the user hears about a problem from the form
rather than from a sync failure they cannot see.

| Form        | Bound                                                                                                                                 | Constraint                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Account     | name 1–80, trimmed                                                                                                                    | `accounts_name_not_blank`                                  |
| Category    | name 1–60                                                                                                                             | `categories_name_not_blank`                                |
| Transaction | amount > 0 and representable, account required, transfer needs a different destination, category required unless transfer, note ≤ 120 | `transactions_amount_positive`, `transactions_note_length` |
| Goal        | name 1–80, target > 0                                                                                                                 | `goals_name_not_blank`                                     |
| Budget      | category required, limit > 0                                                                                                          | `budgets_limit_positive`                                   |
| Profile     | name ≤ 120, no control characters, INR only                                                                                           | `profiles_full_name_length`, `profiles_currency_format`    |
| PIN         | exactly 4 digits                                                                                                                      | —                                                          |
| OTP         | exactly 6 digits                                                                                                                      | —                                                          |

The profile name also rejects control characters, zero-width and bidi
characters: a name is rendered into accessibility labels and into the export,
and a newline or an RTL override in one is at best confusing and at worst a way
to make a row read as something it is not.

### Row-level security, re-verified

The pgTAP suite runs on every change (`npm run db:test`) and passes: **six files, 160
assertions.**

- RLS is `enable`d **and** `force`d on all nine synced tables — forced applies
  the policies to the table owner too, so a mistake in a `SECURITY DEFINER`
  function cannot quietly read across users.
- User A cannot read, update, re-own or reference user B's rows. Child rows use
  composite foreign keys `(column, user_id)`, so a row cannot point at another
  user's parent even with a guessed id.
- There is no DELETE policy for clients and the privilege is revoked; deletes
  are `deleted_at` stamps. Re-asserted this phase from the client's side in
  `06_account_deletion.test.sql`.
- `anon` has no privileges on any table.
- `ai_insight_requests` has RLS on with **no policies at all** and every
  privilege revoked — only the service role reaches it.
- `ai_insight_aggregates` is `SECURITY DEFINER` with a pinned `search_path` and
  `EXECUTE` granted only to `service_role`; a signed-in client calling it gets
  `42501`.

### Data leaving the device

Two paths, both deliberate and both user-initiated:

- **AI insights** — opt-in, and the payload is aggregates and category names
  only. Documented in [AI_INSIGHTS.md](./AI_INSIGHTS.md), enforced by a test
  that walks every key against an allow-list.
- **CSV / JSON export** — user-initiated, into the system share sheet. The CSV
  neutralises fields a spreadsheet would evaluate, because a note reading
  `=cmd|...` is a real attack on whoever opens the file.

Nothing else leaves except the sync to the user's own Supabase project.

---

## How to re-run this review

```bash
npm run lint && npm run typecheck && npm test   # includes the redaction and validation suites
npm run db:test                                 # RLS, privileges and the delete order
grep -rn "console\." src app --include=*.ts --include=*.tsx | grep -v __tests__
grep -rn "process.env" src app | grep -v EXPO_PUBLIC
```

The first two are the ones that matter: every finding above is now a test, so a
regression fails the suite rather than waiting for the next review.
