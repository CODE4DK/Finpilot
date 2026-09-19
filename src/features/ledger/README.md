# Ledger

Balance and period arithmetic. Pure functions only — no hooks, no database.

```
balances.ts   Account balances, net worth, income/expense totals
period.ts     Local day and month boundaries as UTC ranges
grouping.ts   Day groups with per-day totals, flattened for a virtual list
```

## Balances

An account's balance is its opening balance, plus income into it, minus
expenses out of it, minus transfers leaving it, plus transfers arriving in it.

A transfer therefore touches **two** accounts and nets to zero across them,
which is why:

- net worth is unchanged by moving money between your own accounts, and
- `periodTotals` excludes transfers: counting them would make moving ₹1000
  between your own accounts look like ₹1000 of income _and_ ₹1000 of spending.

Soft-deleted rows count as nothing, everywhere.

## Timezones

Grouping uses the **device's** local zone. `profiles.timezone` exists and is
shown in settings, but Hermes on Android ships a trimmed ICU, so
`Intl.DateTimeFormat` with an arbitrary `timeZone` cannot be relied on for the
grouping path on device — a test suite that passed in Node would be wrong on a
phone.

That is correct for a user on their own phone in their own country, and wrong
only for someone travelling who expects their transactions to stay grouped by
home time. Revisit with a tz library when that matters.

`npm run test:timezones` runs `period.timezone.test.ts` under IST, UTC,
New York (negative offset, DST) and Chatham (12:45 offset). Jest sandboxes
`process.env`, so the zone has to be set before the process starts — which is
why that is a separate script rather than another `describe.each`.
