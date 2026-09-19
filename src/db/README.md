# Database layer

Local-first SQLite (PowerSync) mirrored to Supabase Postgres. The design and
the conflict strategy are in [docs/SYNC.md](../../docs/SYNC.md).

```
schema.ts          Local SQLite schema mirroring the nine synced tables
powersync.ts       The database instance, connect / disconnect / clear
connector.ts       fetchCredentials + uploadData (the upload queue)
upload-errors.ts   Transient vs permanent triage for failed uploads
row-mappers.ts     SQLite's INTEGER/TEXT <-> booleans, dates, JSON, paise
sync-status.ts     PowerSync status -> synced | syncing | offline | error
repositories/      Queries and local-first writes, one per table
hooks.ts           Reactive hooks (useAccounts, useTransactions(filters), ...)
database.types.ts  Generated from Postgres - never edit (npm run db:types)
enums.ts           Unions for the TEXT + CHECK columns
```

Rules of thumb:

- **Reads are reactive.** Repositories expose a `*Query()` that returns SQL and
  parameters; hooks hand that to `useQuery` so a screen re-renders whenever the
  rows change. Calling the `async` variants directly is for one-off reads.
- **Writes are local-first.** The client generates the UUID and stamps
  `updated_at` — that timestamp is what decides conflicts.
- **Deletes are local `DELETE`s.** The connector turns each one into a
  server-side `deleted_at` stamp, which is also what removes the row from every
  other device.
- **Repositories take a `PowerSyncDatabaseLike`,** so they can be tested
  against `createMockDatabase` without the native module.
