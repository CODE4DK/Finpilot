-- Row Level Security: user A must not be able to read or modify user B's data.
--
-- Every table is checked the same way, because every table carries the same
-- ownership rule. The two users are seeded through the real auth trigger, so
-- the profile and default categories come from the same code path production
-- uses.

begin;

select plan(54);

\i supabase/tests/helpers/fixtures.sql

-- Two users, created the way Supabase Auth creates them.
select tests.create_user('11111111-1111-4111-8111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'bob@example.com');
select tests.seed_user_data('11111111-1111-4111-8111-111111111111', 'alice');
select tests.seed_user_data('22222222-2222-4222-8222-222222222222', 'bob');

-- ---------------------------------------------------------------------------
-- RLS is switched on everywhere
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = ('public.' || tbl)::regclass),
  'RLS is enabled on ' || tbl
)
from unnest(array[
  'profiles', 'accounts', 'categories', 'recurring_rules', 'transactions',
  'budgets', 'goals', 'goal_contributions', 'insights'
]) as tbl;

select ok(
  (select relforcerowsecurity from pg_class where oid = ('public.' || tbl)::regclass),
  'RLS is forced (owner included) on ' || tbl
)
from unnest(array[
  'profiles', 'accounts', 'categories', 'recurring_rules', 'transactions',
  'budgets', 'goals', 'goal_contributions', 'insights'
]) as tbl;

-- ---------------------------------------------------------------------------
-- Alice sees her own rows, and only her own
-- ---------------------------------------------------------------------------

select tests.authenticate_as('11111111-1111-4111-8111-111111111111');
set local role authenticated;

select is(
  (select count(*) from public.accounts)::int,
  2,
  'alice sees her own accounts'
);
select is(
  (select count(*) from public.accounts where user_id <> '11111111-1111-4111-8111-111111111111')::int,
  0,
  'alice sees no accounts belonging to bob'
);
select is(
  (select count(*) from public.transactions where user_id <> '11111111-1111-4111-8111-111111111111')::int,
  0,
  'alice sees no transactions belonging to bob'
);
select is(
  (select count(*) from public.profiles)::int,
  1,
  'alice sees exactly one profile - her own'
);
select is(
  (select count(*) from public.categories)::int,
  17,
  'alice sees the 17 seeded default categories and no others'
);
select is(
  (select count(*) from public.budgets where user_id <> '11111111-1111-4111-8111-111111111111')::int,
  0,
  'alice sees no budgets belonging to bob'
);
select is(
  (select count(*) from public.goals where user_id <> '11111111-1111-4111-8111-111111111111')::int,
  0,
  'alice sees no goals belonging to bob'
);
select is(
  (select count(*) from public.goal_contributions where user_id <> '11111111-1111-4111-8111-111111111111')::int,
  0,
  'alice sees no goal contributions belonging to bob'
);
select is(
  (select count(*) from public.insights where user_id <> '11111111-1111-4111-8111-111111111111')::int,
  0,
  'alice sees no insights belonging to bob'
);
select is(
  (select count(*) from public.recurring_rules where user_id <> '11111111-1111-4111-8111-111111111111')::int,
  0,
  'alice sees no recurring rules belonging to bob'
);

-- A targeted lookup of a known row of bob's returns nothing rather than erroring.
select is(
  (select count(*) from public.transactions
    where id = (select id from public.transactions where note like 'bob%' limit 1))::int,
  0,
  'alice cannot fetch one of bob''s transactions by id'
);

-- ---------------------------------------------------------------------------
-- Alice cannot modify bob's rows
-- ---------------------------------------------------------------------------

reset role;
create temporary table bob_row_ids as
select
  (select id from public.accounts where user_id = '22222222-2222-4222-8222-222222222222' limit 1) as account_id,
  (select id from public.transactions where user_id = '22222222-2222-4222-8222-222222222222' limit 1) as transaction_id,
  (select id from public.categories where user_id = '22222222-2222-4222-8222-222222222222' limit 1) as category_id,
  (select id from public.budgets where user_id = '22222222-2222-4222-8222-222222222222' limit 1) as budget_id,
  (select id from public.goals where user_id = '22222222-2222-4222-8222-222222222222' limit 1) as goal_id,
  (select id from public.insights where user_id = '22222222-2222-4222-8222-222222222222' limit 1) as insight_id;

-- The test's own scratch table, not application data.
grant select on bob_row_ids to authenticated;

select tests.authenticate_as('11111111-1111-4111-8111-111111111111');
set local role authenticated;

-- An UPDATE that matches no visible row is a silent no-op, so assert the row
-- count rather than expecting an error.
with attempt as (
  update public.accounts set name = 'stolen'
  where id = (select account_id from bob_row_ids)
  returning 1
)
select is((select count(*) from attempt)::int, 0, 'alice cannot rename bob''s account');

with attempt as (
  update public.transactions set amount_paise = 1
  where id = (select transaction_id from bob_row_ids)
  returning 1
)
select is((select count(*) from attempt)::int, 0, 'alice cannot change the amount on bob''s transaction');

with attempt as (
  update public.transactions set deleted_at = now()
  where id = (select transaction_id from bob_row_ids)
  returning 1
)
select is((select count(*) from attempt)::int, 0, 'alice cannot soft-delete bob''s transaction');

with attempt as (
  update public.budgets set limit_paise = 1
  where id = (select budget_id from bob_row_ids)
  returning 1
)
select is((select count(*) from attempt)::int, 0, 'alice cannot change bob''s budget');

with attempt as (
  update public.goals set status = 'archived'
  where id = (select goal_id from bob_row_ids)
  returning 1
)
select is((select count(*) from attempt)::int, 0, 'alice cannot archive bob''s goal');

with attempt as (
  update public.insights set summary = '{"tampered": true}'::jsonb
  where id = (select insight_id from bob_row_ids)
  returning 1
)
select is((select count(*) from attempt)::int, 0, 'alice cannot rewrite bob''s insights');

with attempt as (
  update public.categories set name = 'stolen'
  where id = (select category_id from bob_row_ids)
  returning 1
)
select is((select count(*) from attempt)::int, 0, 'alice cannot rename bob''s category');

-- ---------------------------------------------------------------------------
-- Alice cannot write rows that belong to bob
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.accounts (user_id, type, name)
    values ('22222222-2222-4222-8222-222222222222', 'cash', 'planted')$$,
  '42501',
  'new row violates row-level security policy for table "accounts"',
  'alice cannot insert an account owned by bob'
);

select throws_ok(
  $$insert into public.goals (user_id, name, target_paise)
    values ('22222222-2222-4222-8222-222222222222', 'planted', 100)$$,
  '42501',
  'new row violates row-level security policy for table "goals"',
  'alice cannot insert a goal owned by bob'
);

-- Re-owning one of her own rows is blocked by the UPDATE policy's WITH CHECK.
select throws_ok(
  $$update public.accounts
      set user_id = '22222222-2222-4222-8222-222222222222'
      where user_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  'new row violates row-level security policy for table "accounts"',
  'alice cannot hand one of her accounts to bob'
);

-- ---------------------------------------------------------------------------
-- Alice cannot reference bob's rows from her own
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    $$insert into public.transactions (user_id, type, amount_paise, account_id, category_id)
      values ('11111111-1111-4111-8111-111111111111', 'expense', 100, %L, %L)$$,
    (select account_id from bob_row_ids),
    (select id from public.categories where user_id = '11111111-1111-4111-8111-111111111111' limit 1)
  ),
  '23503',
  null,
  'alice cannot book a transaction against bob''s account'
);

select throws_ok(
  format(
    $$insert into public.budgets (user_id, category_id, month, limit_paise)
      values ('11111111-1111-4111-8111-111111111111', %L, date_trunc('month', now())::date, 100)$$,
    (select category_id from bob_row_ids)
  ),
  '23503',
  null,
  'alice cannot budget against bob''s category'
);

-- ---------------------------------------------------------------------------
-- No hard deletes for anyone
-- ---------------------------------------------------------------------------

select throws_ok(
  $$delete from public.transactions where user_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  null,
  'alice cannot hard-delete even her own transactions'
);

select throws_ok(
  $$delete from public.accounts where user_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  null,
  'alice cannot hard-delete even her own accounts'
);

select is(
  (select count(*) from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and privilege_type = 'DELETE')::int,
  0,
  'neither client role holds the DELETE privilege on any table'
);

-- Soft deletes, on the other hand, work and stay visible to their owner so the
-- deletion can replicate to the user''s other devices.
with attempt as (
  update public.transactions set deleted_at = now()
  where user_id = '11111111-1111-4111-8111-111111111111'
    and type = 'expense'
  returning 1
)
select is((select count(*) from attempt)::int, 1, 'alice can soft-delete her own transaction');

select is(
  (select count(*) from public.transactions where deleted_at is not null)::int,
  1,
  'the soft-deleted row is still visible to its owner'
);

-- ---------------------------------------------------------------------------
-- Anonymous callers get nothing
-- ---------------------------------------------------------------------------

reset role;
select tests.clear_authentication();
set local role anon;

-- anon has no privileges at all here, so it is refused before RLS is even
-- consulted - a stronger outcome than "sees zero rows".
select throws_ok(
  $$select count(*) from public.transactions$$,
  '42501',
  'permission denied for table transactions',
  'anon cannot read transactions'
);
select throws_ok(
  $$select count(*) from public.accounts$$,
  '42501',
  'permission denied for table accounts',
  'anon cannot read accounts'
);
select throws_ok(
  $$select count(*) from public.profiles$$,
  '42501',
  'permission denied for table profiles',
  'anon cannot read profiles'
);

select throws_ok(
  $$insert into public.accounts (user_id, type, name)
    values ('11111111-1111-4111-8111-111111111111', 'cash', 'planted')$$,
  '42501',
  null,
  'anon cannot insert'
);

-- ---------------------------------------------------------------------------
-- Bob still has everything
-- ---------------------------------------------------------------------------

reset role;
select tests.authenticate_as('22222222-2222-4222-8222-222222222222');
set local role authenticated;

select is((select count(*) from public.accounts)::int, 2, 'bob still has both accounts');
select is((select count(*) from public.transactions)::int, 2, 'bob still has both transactions');
select is(
  (select count(*) from public.transactions where deleted_at is not null)::int,
  0,
  'alice''s soft delete did not touch bob''s rows'
);
select is((select name from public.accounts where type = 'bank'), 'bob bank', 'bob''s account name is intact');

select * from finish();

rollback;
