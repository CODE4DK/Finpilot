-- Schema invariants: constraints, triggers, defaults, indexes and the
-- PowerSync publication. These are the rules the client relies on being
-- enforced server-side, whatever a buggy or malicious client sends.

begin;

select plan(57);

\i supabase/tests/helpers/fixtures.sql

select tests.create_user('33333333-3333-4333-8333-333333333333', 'carol@example.com');

-- ---------------------------------------------------------------------------
-- The new-user trigger
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from public.profiles where id = '33333333-3333-4333-8333-333333333333')::int,
  1,
  'creating an auth user creates exactly one profile'
);

select is(
  (select currency from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  'INR',
  'a new profile defaults to INR'
);

select is(
  (select timezone from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  'Asia/Kolkata',
  'a new profile defaults to the Indian timezone'
);

select is(
  (select onboarding_completed from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  false,
  'onboarding starts incomplete'
);

select is(
  (select ai_insights_opt_in from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  false,
  'AI insights are opt-in, off by default'
);

select is(
  (select full_name from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  'carol',
  'full_name is taken from the auth metadata'
);

select is(
  (select user_id from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  '33333333-3333-4333-8333-333333333333'::uuid,
  'profiles.user_id mirrors the id'
);

select is(
  (select count(*) from public.categories where user_id = '33333333-3333-4333-8333-333333333333')::int,
  17,
  'a new user is seeded with 17 default categories'
);

select is(
  (select count(*) from public.categories
    where user_id = '33333333-3333-4333-8333-333333333333' and type = 'income')::int,
  4,
  'four of the defaults are income categories'
);

select is(
  (select count(*) from public.categories
    where user_id = '33333333-3333-4333-8333-333333333333' and type = 'expense')::int,
  13,
  'thirteen of the defaults are expense categories'
);

select is(
  (select array_agg(name order by name)
     from public.categories
    where user_id = '33333333-3333-4333-8333-333333333333'),
  array[
    'Bills & Utilities', 'EMI', 'Education', 'Entertainment', 'Food', 'Freelance',
    'Fuel', 'Groceries', 'Health', 'Interest', 'Other', 'Refund', 'Rent',
    'Salary', 'Shopping', 'Transport', 'Travel'
  ],
  'the seeded categories are exactly the documented Indian default set'
);

select ok(
  (select bool_and(is_default) from public.categories
    where user_id = '33333333-3333-4333-8333-333333333333'),
  'seeded categories are flagged is_default'
);

-- Re-seeding is a no-op rather than a duplicate.
select is(
  public.seed_default_categories('33333333-3333-4333-8333-333333333333'),
  0,
  'seeding twice inserts nothing'
);

-- ---------------------------------------------------------------------------
-- Money and amount constraints
-- ---------------------------------------------------------------------------

select tests.seed_user_data('33333333-3333-4333-8333-333333333333', 'carol');

select throws_ok(
  format(
    $$insert into public.transactions (user_id, type, amount_paise, account_id, category_id)
      values ('33333333-3333-4333-8333-333333333333', 'expense', 0, %L, %L)$$,
    (select id from public.accounts where user_id = '33333333-3333-4333-8333-333333333333' limit 1),
    (select id from public.categories where user_id = '33333333-3333-4333-8333-333333333333' and type = 'expense' limit 1)
  ),
  '23514',
  null,
  'a zero-amount transaction is rejected'
);

select throws_ok(
  format(
    $$insert into public.transactions (user_id, type, amount_paise, account_id, category_id)
      values ('33333333-3333-4333-8333-333333333333', 'expense', -100, %L, %L)$$,
    (select id from public.accounts where user_id = '33333333-3333-4333-8333-333333333333' limit 1),
    (select id from public.categories where user_id = '33333333-3333-4333-8333-333333333333' and type = 'expense' limit 1)
  ),
  '23514',
  null,
  'a negative amount is rejected - direction comes from type, not sign'
);

select has_column('public', 'transactions', 'amount_paise', 'transactions.amount_paise exists');
select col_type_is('public', 'transactions', 'amount_paise', 'bigint', 'money is stored as bigint paise');
select col_type_is('public', 'accounts', 'opening_balance_paise', 'bigint', 'opening balance is bigint paise');
select col_type_is('public', 'budgets', 'limit_paise', 'bigint', 'budget limits are bigint paise');
select col_type_is('public', 'goals', 'target_paise', 'bigint', 'goal targets are bigint paise');

-- ---------------------------------------------------------------------------
-- Transfer shape
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    $$insert into public.transactions (user_id, type, amount_paise, account_id)
      values ('33333333-3333-4333-8333-333333333333', 'transfer', 100, %L)$$,
    (select id from public.accounts where user_id = '33333333-3333-4333-8333-333333333333' limit 1)
  ),
  '23514',
  null,
  'a transfer without a destination account is rejected'
);

select throws_ok(
  format(
    $$insert into public.transactions (user_id, type, amount_paise, account_id, to_account_id)
      values ('33333333-3333-4333-8333-333333333333', 'transfer', 100, %L, %L)$$,
    (select id from public.accounts where user_id = '33333333-3333-4333-8333-333333333333' limit 1),
    (select id from public.accounts where user_id = '33333333-3333-4333-8333-333333333333' limit 1)
  ),
  '23514',
  null,
  'a transfer to the same account is rejected'
);

select throws_ok(
  format(
    $$insert into public.transactions (user_id, type, amount_paise, account_id, to_account_id, category_id)
      values ('33333333-3333-4333-8333-333333333333', 'expense', 100, %L, %L, %L)$$,
    (select id from public.accounts where user_id = '33333333-3333-4333-8333-333333333333' limit 1),
    (select id from public.accounts where user_id = '33333333-3333-4333-8333-333333333333' offset 1 limit 1),
    (select id from public.categories where user_id = '33333333-3333-4333-8333-333333333333' and type = 'expense' limit 1)
  ),
  '23514',
  null,
  'a non-transfer with a destination account is rejected'
);

select throws_ok(
  format(
    $$insert into public.transactions (user_id, type, amount_paise, account_id)
      values ('33333333-3333-4333-8333-333333333333', 'expense', 100, %L)$$,
    (select id from public.accounts where user_id = '33333333-3333-4333-8333-333333333333' limit 1)
  ),
  '23514',
  null,
  'an income or expense without a category is rejected'
);

-- ---------------------------------------------------------------------------
-- Enumerated values
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.accounts (user_id, type, name)
    values ('33333333-3333-4333-8333-333333333333', 'crypto', 'nope')$$,
  '23514',
  null,
  'an unknown account type is rejected'
);

select throws_ok(
  $$insert into public.goals (user_id, name, target_paise, status)
    values ('33333333-3333-4333-8333-333333333333', 'nope', 100, 'paused')$$,
  '23514',
  null,
  'an unknown goal status is rejected'
);

select throws_ok(
  format(
    $$insert into public.recurring_rules
        (user_id, type, amount_paise, account_id, category_id, frequency, next_run_at)
      values ('33333333-3333-4333-8333-333333333333', 'expense', 100, %L, %L, 'fortnightly', now())$$,
    (select id from public.accounts where user_id = '33333333-3333-4333-8333-333333333333' limit 1),
    (select id from public.categories where user_id = '33333333-3333-4333-8333-333333333333' and type = 'expense' limit 1)
  ),
  '23514',
  null,
  'an unknown recurrence frequency is rejected'
);

select throws_ok(
  format(
    $$insert into public.recurring_rules
        (user_id, type, amount_paise, account_id, category_id, frequency, "interval", next_run_at)
      values ('33333333-3333-4333-8333-333333333333', 'expense', 100, %L, %L, 'monthly', 0, now())$$,
    (select id from public.accounts where user_id = '33333333-3333-4333-8333-333333333333' limit 1),
    (select id from public.categories where user_id = '33333333-3333-4333-8333-333333333333' and type = 'expense' limit 1)
  ),
  '23514',
  null,
  'a zero recurrence interval is rejected'
);

-- ---------------------------------------------------------------------------
-- Month-keyed tables
-- ---------------------------------------------------------------------------

select throws_ok(
  format(
    $$insert into public.budgets (user_id, category_id, month, limit_paise)
      values ('33333333-3333-4333-8333-333333333333', %L, date '2026-09-15', 100)$$,
    (select id from public.categories where user_id = '33333333-3333-4333-8333-333333333333' and type = 'expense' offset 1 limit 1)
  ),
  '23514',
  null,
  'a budget month must be the first of the month'
);

select throws_ok(
  format(
    $$insert into public.budgets (user_id, category_id, month, limit_paise)
      values ('33333333-3333-4333-8333-333333333333', %L, date_trunc('month', now())::date, 100)$$,
    (select category_id from public.budgets where user_id = '33333333-3333-4333-8333-333333333333' limit 1)
  ),
  '23505',
  null,
  'a category can only have one live budget per month'
);

select throws_ok(
  $$insert into public.insights (user_id, month, summary)
    values ('33333333-3333-4333-8333-333333333333', date_trunc('month', now())::date, '[]'::jsonb)$$,
  '23514',
  null,
  'an insight summary must be a JSON object'
);

-- ---------------------------------------------------------------------------
-- Soft-delete columns and the updated_at trigger
-- ---------------------------------------------------------------------------

select has_column('public', tbl, 'user_id', tbl || ' has user_id')
from unnest(array[
  'profiles', 'accounts', 'categories', 'recurring_rules', 'transactions',
  'budgets', 'goals', 'goal_contributions', 'insights'
]) as tbl;

select ok(
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = tbl
      and column_name in ('created_at', 'updated_at', 'deleted_at')) = 3,
  tbl || ' has created_at, updated_at and deleted_at'
)
from unnest(array[
  'profiles', 'accounts', 'categories', 'recurring_rules', 'transactions',
  'budgets', 'goals', 'goal_contributions', 'insights'
]) as tbl;

-- The trigger must win even when the client sends a stale timestamp. It
-- stamps now() - the transaction clock - so the assertion is "it equals the
-- server's transaction time", not "it is strictly later than before".
with touched as (
  update public.transactions
     set note = 'edited', updated_at = timestamptz '2000-01-01'
   where id = (select id from public.transactions
               where user_id = '33333333-3333-4333-8333-333333333333' limit 1)
  returning updated_at
)
select is(
  (select updated_at from touched),
  now(),
  'the updated_at trigger overrides whatever the client sends'
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

select has_index('public', 'transactions', 'transactions_user_id_idx', 'transactions are indexed by user_id');
select has_index('public', 'transactions', 'transactions_user_occurred_at_idx', 'transactions are indexed by user and occurred_at');
select has_index('public', 'transactions', 'transactions_occurred_at_idx', 'transactions are indexed by occurred_at');
select has_index('public', 'accounts', 'accounts_user_id_idx', 'accounts are indexed by user_id');
select has_index('public', 'budgets', 'budgets_user_id_idx', 'budgets are indexed by user_id');

-- ---------------------------------------------------------------------------
-- PowerSync publication
-- ---------------------------------------------------------------------------

select ok(
  exists (select 1 from pg_publication where pubname = 'powersync'),
  'the powersync publication exists'
);

select is(
  (select count(*)::int from pg_publication_tables where pubname = 'powersync'),
  9,
  'all nine synced tables are in the powersync publication'
);

select * from finish();

rollback;
