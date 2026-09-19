# Database layer

PowerSync (offline-first SQLite) mirrored to Supabase Postgres.

Here now:

- `database.types.ts` — **generated** from the live schema (`npm run db:types`).
  Do not edit by hand.
- `enums.ts` — literal unions, type guards and shape helpers for the columns
  the database stores as `TEXT` + `CHECK` (account type, transaction type,
  recurrence frequency, goal status).
- `index.ts` — the public surface: `import { type Tables, isAccountType } from '@/db'`.

Landing in a later phase:

- `schema.ts` — the PowerSync schema shared by every synced table.
- `powersync.ts` — client setup, the Supabase connector and the upload queue.

The SQL itself lives in `supabase/migrations/`, and the schema is documented in
[docs/DATABASE.md](../../docs/DATABASE.md). Every synced table carries `id`
(client-generated UUID), `user_id`, `created_at`, `updated_at` and `deleted_at`.
Deletes are soft: set `deleted_at`, never remove the row — the database has no
DELETE policy for clients.
