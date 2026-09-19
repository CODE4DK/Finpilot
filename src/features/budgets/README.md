# Budgets

A monthly limit per expense category, and the alerts that go with it.

```
budget-math.ts        Spent vs limit, tone bands, days left, safe per day
alerts.ts             Which thresholds are owed - pure
notifications.ts      Permission and delivery (expo-notifications)
use-budget-alerts.ts  Watches this month's budgets and delivers
budget-form-screen.tsx
```

## The bands

Green below 80%, amber from 80% to just under 100%, red at 100% and above.
Defined once in `toneFor` — nothing else decides "am I over budget?".

Colour is never the only signal: the percentage is shown next to every bar and
included in the accessibility label, because roughly one man in twelve cannot
reliably tell the amber from the green.

## Alerting once, and only once

The rule: **at most one notification per budget per threshold per month.** A
budget sitting at 85% must not buzz on every coffee.

`alert_80_sent` and `alert_100_sent` on the budget row enforce it. They are
synced columns, so a second device that receives the row stays quiet too — the
flag is the record of "this has been said", not "this device said it".

Two details that matter:

- A budget that jumps straight from 10% to 130% announces **only** the 100%
  crossing. Being told you are near the limit right after being told you are
  past it is noise, so delivering 100 marks 80 as well.
- Flags are written **after** delivery succeeds. A revoked permission must not
  silently burn the one alert a budget gets.

Raising a limit clears both flags (`setLimit`), so the user can be warned again
against the larger budget. Lowering it does not.

## Permission

Requested when the user turns budget alerts on in Settings — **never at
launch**. A prompt with no context is the one people deny permanently, and iOS
only asks once. If the OS has stopped asking, the copy points at phone settings
rather than pretending the toggle will work.
