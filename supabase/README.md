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
[docs/DATABASE.md](../docs/DATABASE.md). There are two Edge Functions:
`generate-insights`, documented with the secret it needs in
[docs/AI_INSIGHTS.md](../docs/AI_INSIGHTS.md), and `delete-account`, the one
place in FinPilot that performs a hard delete - see
[docs/SECURITY_REVIEW.md](../docs/SECURITY_REVIEW.md).

## Secrets

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy generate-insights
npx supabase functions deploy delete-account
```

`delete-account` needs no secret of its own - the platform injects
`SUPABASE_SERVICE_ROLE_KEY`, which is what lets it remove the auth user.

`ANTHROPIC_API_KEY` lives here and nowhere else. Only `EXPO_PUBLIC_*`
variables reach the app bundle, and a key in a bundle is a published key.

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
