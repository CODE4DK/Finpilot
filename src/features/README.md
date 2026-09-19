# Features

One folder per domain feature (`accounts/`, `transactions/`, `budgets/`,
`insights/`, `auth/`). Each feature owns its business logic and keeps screen
files thin:

```
src/features/transactions/
  api.ts          # PowerSync / Supabase queries for this feature
  model.ts        # types + pure helpers (amounts in integer paise)
  use-transactions.ts
  components/
  __tests__/
```

Rules of thumb:

- Pure calculations live here and are unit tested - screens only render.
- Nothing in `app/` should import from another feature's internals; export a
  feature's public surface from its `index.ts`.
