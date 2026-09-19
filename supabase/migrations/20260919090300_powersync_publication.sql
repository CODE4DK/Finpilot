-- PowerSync replication.
--
-- PowerSync tails Postgres logical replication through a dedicated publication
-- named `powersync`. Tables are listed explicitly rather than using FOR ALL
-- TABLES so that adding a table is a deliberate, reviewed act - anything in
-- this publication is replicated to devices.
--
-- Prerequisites on the Supabase project (see docs/DATABASE.md):
--   * wal_level = logical  (already the default on Supabase)
--   * a `powersync` role with REPLICATION, created outside of migrations
--     because it needs a password that must not live in version control.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'powersync') then
    drop publication powersync;
  end if;
end;
$$;

create publication powersync for table
  public.profiles,
  public.accounts,
  public.categories,
  public.recurring_rules,
  public.transactions,
  public.budgets,
  public.goals,
  public.goal_contributions,
  public.insights;

-- Logical replication needs to identify a row on UPDATE and DELETE. The
-- primary key is enough for us: all of these tables have a UUID PK and we
-- never hard-delete, so DEFAULT replica identity keeps WAL small while still
-- letting PowerSync match rows.
do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles', 'accounts', 'categories', 'recurring_rules', 'transactions',
    'budgets', 'goals', 'goal_contributions', 'insights'
  ]
  loop
    execute format('alter table public.%I replica identity default', target);
  end loop;
end;
$$;
