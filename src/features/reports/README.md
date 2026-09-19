# Reports

Everything behind the Reports tab: the period selector, the aggregation, the
two charts and the CSV export.

## Why the SQL lives here

Every figure on the screen is summed by SQLite **on the device**, in
`queries.ts`. Nothing is computed server-side and nothing is fetched, so the
tab is as complete on a train with no signal as it is on wifi. The builders
return `{ sql, parameters }` rather than executing, exactly like
`src/db/repositories/*` do, so `use-reports.ts` can hand the same statement to
PowerSync's `useQuery` and get a result that re-renders the moment a
transaction changes - locally or from a sync.

Two rules run through all of them: transfers are excluded, because moving money
between your own accounts is neither income nor expense; and soft-deleted rows
are excluded, because a delete is a `deleted_at` stamp and the row is still in
the table.

## Why months are a UNION rather than a GROUP BY

`occurred_at` is a UTC instant, and the buckets have to be **local** calendar
months (see `src/features/ledger/README.md` for the timezone decision). Rather
than ask SQLite to know the device's zone, `monthlyTotalsQuery` unions one
aggregate per month with explicit local boundaries computed in JavaScript. It
also means a month with no transactions still returns a row, so a quiet month
draws a zero bar instead of disappearing off the axis.

## Charts

`components/` holds the two Victory Native (Skia) charts. Each one:

- is a single accessibility node carrying a sentence built in `summaries.ts` -
  a Skia canvas tells a screen reader nothing, and exposing individual slices
  would announce a list of shapes;
- never carries identity in colour alone: the donut ships with the ranked list
  beside it and the bars with a legend and month labels;
- has an empty state on the screen rather than an empty canvas.

Colours come from `src/theme/chart-colors.ts`, which documents the CVD
validation - including why the trend bars are blue and orange and not the
app's income green and expense red.

## CSV

`csv.ts` is pure and fully tested; `export-csv.ts` is the thin native edge that
writes the file into the cache directory and opens the share sheet. The output
is BOM-prefixed, CRLF-terminated, and quotes fields that could be read as a
formula - a note reading `=cmd|...` is a real attack on whoever opens the file.
