# Supabase

Server-side project assets, managed with the Supabase CLI.

```
supabase/
  config.toml    Local stack configuration
  migrations/    SQL migrations (schema, RLS policies, triggers, publication)
  functions/     Edge Functions - the only place server secrets may be used
  tests/         pgTAP suites, run by `supabase test db` or scripts/db-test.sh
```

The schema, its policies and how to work on it are documented in
[docs/DATABASE.md](../docs/DATABASE.md).

## Linking to a project

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # apply migrations to the linked project
```

## Local development

```bash
npm run db:start   # supabase start (needs Docker)
npm run db:reset   # re-apply every migration from scratch
npm run db:test    # pgTAP suite (works without Docker - see docs/DATABASE.md)
npm run db:types   # regenerate src/db/database.types.ts
```

Every table is protected by RLS scoped to `auth.uid() = user_id`, and clients
never hard-delete. The service-role key must never appear in the app bundle.
