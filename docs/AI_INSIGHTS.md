# AI insights

FinPilot can send a **summary of a month** to Anthropic's Claude and get back a
few sentences about what changed and what the user might do about it. It is the
only part of the app that sends anything anywhere except the user's own
Supabase project, so this document is mostly about the limits on that.

Three properties hold at all times:

1. **It is off until the user turns it on.** `profiles.ai_insights_opt_in`
   defaults to `false`, and the Edge Function checks it server-side - the app
   is not a security boundary.
2. **It only runs when the user taps Generate.** Never on a schedule, never on
   launch, never in the background.
3. **Nothing about it is required.** With it off, or offline, or after the
   day's generations are used up, the same screens show insights computed on
   the device from the same numbers.

---

## What is sent

Everything that leaves the device is built by one function -
`supabase/functions/generate-insights/payload.ts` - and nothing else is ever
serialised into the request. The payload is:

| Field                           | Example                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `month`, `currency`             | `"2026-09-01"`, `"INR"`                                              |
| `days_elapsed`, `days_in_month` | `19`, `30`                                                           |
| `totals`                        | income, expense, net, transaction count, daily average               |
| `previous_month`                | last month's income and expense                                      |
| `categories[]`                  | category **name**, amount, share, count, last month's amount, change |
| `budgets[]`                     | category name, limit, spent, percent used                            |
| `goals[]`                       | `label` (`goal_1`), target, saved, progress, target date             |

Amounts are rupees with two decimals, because that is what the model reads
well. Money is integer paise everywhere else in the app.

### What is never sent

- **Transaction notes.** This is the important one: a note is where people
  write "loan to Ravi" or a card's last four digits.
- **Account names.** Identifying on their own, and irrelevant to the analysis.
- **Goal names.** A goal is free text a person typed - "Meera's wedding". The
  model sees `goal_1`, and the Edge Function substitutes the real name back
  into the answer before storing it (`buildLabelMap` / `hydrateLabels`), so the
  user reads their own words in a sentence the model wrote without them.
- **Ids of any kind**, the user's name, or their email.
- **Individual transactions.** Only the totals they add up to.

### The one deliberate exception: category names

Category names **are** sent. They are the analysis - "you spent more on Food"
is not sayable without the word Food. The seventeen defaults are generic, but a
user can create a category with any name they like, and a custom category name
is free text. That trade-off is stated on the consent screen in those terms,
and it is the reason category names are the only user-authored strings in the
payload.

### How that is kept true

Two tests, at two levels:

- `src/features/insights/__tests__/payload.test.ts` feeds the builder rows
  carrying notes, account names, goal names and an email, then asserts on the
  serialised payload that none of it survived - and walks every key at every
  depth against an explicit allow-list, so a new field fails the suite rather
  than quietly widening what leaves the device.
- `supabase/tests/05_ai_insight_aggregates.test.sql` asserts the same thing one
  level down, on the SQL: the aggregation function returns no note, no account
  name, nothing belonging to another user, and no transfer amounts.

---

## The Edge Function

`supabase/functions/generate-insights/`

```
index.ts      the handler: auth, opt-in, rate limit, call, validate, store
payload.ts    what may leave the device (pure - the app's tests import it)
schema.ts     the JSON contract and the zod validator (pure)
prompt.ts     the system and user prompts
deno.json     the import map
```

The order of the checks is the design:

1. **Verify the JWT.** An anon client created with the caller's own
   `Authorization` header calls `auth.getUser()`. Nothing downstream trusts a
   user id from the request body.
2. **Check the opt-in**, server-side.
3. **Rate limit**: `DAILY_LIMIT = 5` per user per day, counted from the
   `ai_insight_requests` table. Attempts are counted, not successes - a user
   who triggers five failing calls has still cost five calls to the model. A
   request rejected before it cost anything (not opted in, already limited) is
   logged but does not count.
4. **Build the payload** - the first point at which the user's data is read.
5. **Call the model, validate, store.**

The model is `claude-opus-5`, called with structured outputs
(`output_config.format`) against `INSIGHT_JSON_SCHEMA`, at `effort: 'medium'` -
this is a short summarisation task over figures that are already computed.

### Validation

The response is parsed with zod (`validateInsightResponse`). Structured outputs
make a malformed response unlikely; validating anyway is what makes one
_harmless_. A response that fails is recorded as `invalid_response`, the app is
told, and it falls back to its own rules. Nothing half-valid ever reaches the
`insights` table, where the app would render it.

The bounds are deliberate: a summary is capped at 600 characters and each list
at five items, because an unbounded string is a card that pushes the Home
screen off the bottom.

The failure reason written to the log contains **issue paths only** - never the
model's text, which carries the user's figures.

### The request log

`ai_insight_requests` is server-side only: not in the PowerSync publication,
RLS enabled with no policies at all, and every privilege revoked from `anon`
and `authenticated`. Only the service role - which never appears in the app
bundle - touches it. It records the month, the outcome, the model and token
counts. It is both the rate limit and the audit trail for a feature that sends
data to a third party.

### Aggregation

`public.ai_insight_aggregates(user_id, month)` is a `SECURITY DEFINER` function
with a pinned `search_path`, executable only by `service_role`. The shape of
what the AI feature may read lives there, in the schema, next to the tables it
reads - rather than scattered through a handler where a new column could
quietly join the payload.

---

## The on-device fallback

`src/features/insights/rule-based.ts` computes an insight from the local
database: the month's totals against last month's, the largest category, the
daily pace and where it lands, categories that are materially up, budgets that
are over or pacing over, and what a goal still needs.

It is not a degraded placeholder. Most of what is worth saying about a month is
arithmetic, and arithmetic works with the radio off. Two thresholds keep it
honest: a change has to be at least ₹500 **and** at least 25% before it is
called unusual, so neither a ten-fold rise in tea nor a 2% rise in rent is
reported as news.

The card and the screen always state which kind of insight is on screen - an
`AI` or `On device` badge. A sentence written by a model and a sentence
computed from arithmetic deserve different amounts of trust, and that is the
user's call to make.

---

## Running it

### Secrets

The function needs `ANTHROPIC_API_KEY` in Supabase secrets. It is never in the
app bundle - only `EXPO_PUBLIC_*` variables reach the client, and an API key in
a client is a published API key.

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the platform.

### Deploy

```bash
supabase functions deploy generate-insights
supabase db push                      # the two migrations this feature adds
```

### Locally

```bash
supabase functions serve generate-insights --env-file supabase/.env.local
deno check supabase/functions/generate-insights/index.ts
```

The function is Deno, so it is **excluded from the app's `tsconfig.json`** -
npm: specifiers, `.ts` import paths and the `Deno` global are all correct there
and wrong in React Native. `payload.ts` and `schema.ts` import nothing from
Deno precisely so the app's Jest suite can import and test them; they are
type-checked through those tests.

### Cost

One generation is a few thousand input tokens and a few hundred output tokens.
The daily limit is five per user. Token counts per call are in
`ai_insight_requests`, so the real number is measurable rather than estimated.
