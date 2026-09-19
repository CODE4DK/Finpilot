# Recurring

Repeating transactions: rent, subscriptions, salary.

```
schedule.ts                 When a rule fires next - pure, heavily tested
generate.ts                 Deterministic ids and the catch-up plan - pure
run-generation.ts           Applies a plan through the repositories
use-recurring-generation.ts Runs it on launch and on foreground
```

## The month-end problem

A naive "add one month" drifts. 31 January + 1 month is 31 February, which
JavaScript rolls forward to 3 March — and from then on the rule fires on the
3rd, forever. So a rule carries an **anchor day** and every occurrence is
clamped to the length of its own month:

```
31 Jan → 28 Feb → 31 Mar → 30 Apr → 31 May …
```

Short months clamp; the next long month returns to the anchor. The same rule
covers 29 February for yearly rules: 2024 → 2025 falls back to the 28th, and
2028 returns to the 29th.

## Idempotency across devices

Two devices, both offline, must not each create "September's rent". They
cannot coordinate, so the id is not random — it is
`uuidv5(ruleId + ':' + occurrenceISO, RECURRING_NAMESPACE)`. Same rule, same
occurrence, same id on every device, forever, and the upload converges to one
row because a PUT is an upsert. Locally, `INSERT OR IGNORE` makes a re-run a
no-op.

`RECURRING_NAMESPACE` must never change. A new namespace would orphan every id
already generated, and the duplicates could not be reconciled — there is a test
pinning both the namespace and a known id for a known input.

## Catch-up

On launch (and whenever the app returns to the foreground) every due rule is
walked from `next_run_at` to now. The walk is capped at
`MAX_CATCH_UP_OCCURRENCES` (200) so a rule abandoned for years cannot hang the
launch; the next run resumes where it stopped. A rule past its `end_at` is
retired rather than checked on every launch.
