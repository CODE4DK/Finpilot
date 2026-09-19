# Database layer

PowerSync (offline-first SQLite) mirrored to Supabase Postgres.

Landing here in Phase 2:

- `schema.ts` - the PowerSync schema shared by every synced table.
- `powersync.ts` - client setup, the Supabase connector and the upload queue.
- `migrations/` - client-side schema versioning notes.

Every synced table carries `id` (client-generated UUID), `user_id`,
`created_at`, `updated_at` and `deleted_at`. Deletes are soft: set
`deleted_at`, never remove the row.
