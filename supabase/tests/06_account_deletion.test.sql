-- Account deletion, from the database's side.
--
-- The delete-account Edge Function performs the one hard delete in FinPilot.
-- This suite is what makes that safe to run: the service role can do it, a
-- client cannot, and when it happens nothing of the user is left behind.

begin;

select plan(10);

\i supabase/tests/helpers/fixtures.sql

select tests.create_user('11111111-1111-4111-8111-111111111111', 'alice@example.com');
select tests.create_user('22222222-2222-4222-8222-222222222222', 'bob@example.com');
select tests.seed_user_data('11111111-1111-4111-8111-111111111111', 'alice');
select tests.seed_user_data('22222222-2222-4222-8222-222222222222', 'bob');

-- ---------------------------------------------------------------------------
-- A client still cannot hard-delete anything
-- ---------------------------------------------------------------------------

select tests.authenticate_as('11111111-1111-4111-8111-111111111111');
set local role authenticated;

select throws_ok(
  $$delete from public.transactions where user_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  null,
  'a signed-in user cannot hard-delete their own transactions'
);
select throws_ok(
  $$delete from public.accounts where user_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  null,
  'a signed-in user cannot hard-delete their own accounts'
);

reset role;
select tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- The service role can, which is how the Edge Function does it
-- ---------------------------------------------------------------------------

select has_table('public', 'ai_insight_requests', 'the AI request log is part of what gets deleted');

select lives_ok(
  $$delete from public.goal_contributions where user_id = '11111111-1111-4111-8111-111111111111';
    delete from public.transactions where user_id = '11111111-1111-4111-8111-111111111111';
    delete from public.recurring_rules where user_id = '11111111-1111-4111-8111-111111111111';
    delete from public.budgets where user_id = '11111111-1111-4111-8111-111111111111';
    delete from public.goals where user_id = '11111111-1111-4111-8111-111111111111';
    delete from public.insights where user_id = '11111111-1111-4111-8111-111111111111';
    delete from public.categories where user_id = '11111111-1111-4111-8111-111111111111';
    delete from public.accounts where user_id = '11111111-1111-4111-8111-111111111111';
    delete from public.ai_insight_requests where user_id = '11111111-1111-4111-8111-111111111111';
    delete from public.profiles where id = '11111111-1111-4111-8111-111111111111'$$,
  'the delete order the Edge Function uses satisfies every foreign key'
);

select is(
  (select count(*)::int from public.transactions
   where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'nothing of the deleted user is left in transactions'
);
select is(
  (select count(*)::int from public.profiles
   where id = '11111111-1111-4111-8111-111111111111'),
  0,
  'the profile is gone'
);

-- ---------------------------------------------------------------------------
-- The other user is untouched
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.transactions
   where user_id = '22222222-2222-4222-8222-222222222222'),
  2,
  'the other user keeps their transactions'
);
select is(
  (select count(*)::int from public.categories
   where user_id = '22222222-2222-4222-8222-222222222222'),
  17,
  'the other user keeps their categories'
);

-- ---------------------------------------------------------------------------
-- Deleting the auth user cascades, so a partial failure cannot orphan rows
-- ---------------------------------------------------------------------------

select lives_ok(
  $$delete from auth.users where id = '22222222-2222-4222-8222-222222222222'$$,
  'deleting the auth user succeeds'
);
select is(
  (select count(*)::int from public.transactions
   where user_id = '22222222-2222-4222-8222-222222222222'),
  0,
  'the cascade removes their rows even if the function never got to them'
);

select * from finish();

rollback;
