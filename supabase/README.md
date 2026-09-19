# Supabase

Server-side project assets, managed with the Supabase CLI.

```
supabase/
  migrations/   # SQL migrations (schema + row level security policies)
  functions/    # Edge Functions - the only place server secrets may be used
```

Getting started once the CLI is installed:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Every table is protected by RLS scoped to `auth.uid() = user_id`. The
service-role key must never appear in the app bundle.
