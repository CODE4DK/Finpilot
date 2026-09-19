-- What the AI feature is allowed to read.
--
-- ai_insight_aggregates is the only query the Edge Function runs against a
-- user's data, so this suite is the schema-level half of the privacy promise:
-- the numbers are right, the free text is absent, and a signed-in client
-- cannot call it at all.

begin;

select plan(11);

\i supabase/tests/helpers/fixtures.sql

select tests.create_user('11111111-1111-4111-8111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'bob@example.com');
select tests.seed_user_data('11111111-1111-4111-8111-111111111111', 'alice');
select tests.seed_user_data('22222222-2222-4222-8222-222222222222', 'bob');

create temporary table aggregates as
select public.ai_insight_aggregates(
  '11111111-1111-4111-8111-111111111111',
  date_trunc('month', now())::date
) as result;

-- ---------------------------------------------------------------------------
-- The numbers
-- ---------------------------------------------------------------------------

select is(
  (select (result -> 'current' ->> 'expense_paise')::bigint from aggregates),
  184550::bigint,
  'the expense total is the month''s expenses'
);

-- The fixture also has a 5,000 rupee transfer. Money moved between your own
-- accounts is neither income nor expense, so it must not appear anywhere.
select is(
  (select (result -> 'current' ->> 'income_paise')::bigint from aggregates),
  0::bigint,
  'a transfer is not counted as income'
);
select is(
  (select sum((entry ->> 'spent_paise')::bigint)::bigint
   from aggregates, jsonb_array_elements(result -> 'currentCategories') as entry),
  184550::bigint,
  'the category totals add up to the expenses alone - the transfer is not among them'
);

select is(
  (select jsonb_array_length(result -> 'currentCategories') from aggregates),
  1,
  'one category was spent in'
);

select is(
  (select (result -> 'budgets' -> 0 ->> 'limit_paise')::bigint from aggregates),
  1000000::bigint,
  'the budget limit is included'
);
select is(
  (select (result -> 'goals' -> 0 ->> 'saved_paise')::bigint from aggregates),
  1000000::bigint,
  'goal progress is included'
);

select ok(
  (select (result ->> 'elapsedDays')::int between 1 and 31 from aggregates),
  'the elapsed days are a sane count'
);

-- ---------------------------------------------------------------------------
-- The free text that must never be in it
-- ---------------------------------------------------------------------------

select ok(
  (select result::text not like '%groceries%' from aggregates),
  'a transaction note is not in the aggregates'
);
select ok(
  (select result::text not like '%alice bank%' and result::text not like '%alice cash%'
   from aggregates),
  'an account name is not in the aggregates'
);

-- ---------------------------------------------------------------------------
-- Scope and privilege
-- ---------------------------------------------------------------------------

select ok(
  (select result::text not like '%bob%' from aggregates),
  'nothing of another user reaches the aggregates'
);

select tests.authenticate_as('11111111-1111-4111-8111-111111111111');
set local role authenticated;

select throws_ok(
  $$select public.ai_insight_aggregates(
      '11111111-1111-4111-8111-111111111111',
      date_trunc('month', now())::date)$$,
  '42501',
  null,
  'a signed-in client cannot run the aggregation itself'
);

reset role;

select * from finish();

rollback;
