# Goals

What someone is saving for, and whether they are on course.

```
projection.ts   Progress, required monthly saving, projected completion
use-goal.ts     One goal with its contributions and everything derived
```

## Two different kinds of number

**Required monthly saving** is arithmetic: what is left, divided by the months
until the target date, rounded up so the target is actually met rather than
just missed. It is null when there is no target date — there is nothing to
divide by.

**Projected completion** is a guess: the average contribution per month so far,
extrapolated. It is labelled as an estimate on screen, and it is **null** when
there is nothing to base it on. A goal with no contributions has no rate, and
inventing a date would be worse than saying "add a contribution to see your
pace".

The average is measured from the first contribution, not from when the goal was
created — a goal made in January and first funded in June has a six-month
history, not a one-month one.

## Completion

A goal is complete when saved ≥ target. The celebration fires on the
_transition_, not on every render of an already-finished goal, and the status is
written back to `completed` so the list and the server agree.
