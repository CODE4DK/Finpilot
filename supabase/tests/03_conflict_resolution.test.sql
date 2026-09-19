-- Last write wins, decided by updated_at.
--
-- The scenario these guard: two devices edit the same row while one is
-- offline. When the offline device reconnects it uploads an edit that is
-- older than one already applied from the other device. It must lose.

begin;

select plan(16);

\i supabase/tests/helpers/fixtures.sql

select tests.create_user('44444444-4444-4444-8444-444444444444', 'dana@example.com');
select tests.seed_user_data('44444444-4444-4444-8444-444444444444', 'dana');

create temporary table subject as
select id, updated_at
from public.accounts
where user_id = '44444444-4444-4444-8444-444444444444' and type = 'bank'
limit 1;

-- ---------------------------------------------------------------------------
-- A client that sends no updated_at gets the server clock, as before
-- ---------------------------------------------------------------------------

update public.accounts set name = 'server-side rename'
where id = (select id from subject);

select is(
  (select updated_at from public.accounts where id = (select id from subject)),
  now(),
  'an update with no client timestamp is stamped with the server clock'
);

select is(
  (select name from public.accounts where id = (select id from subject)),
  'server-side rename',
  'and the update is applied'
);

-- ---------------------------------------------------------------------------
-- A newer client timestamp wins and is preserved
-- ---------------------------------------------------------------------------

update public.accounts
   set name = 'edited on phone', updated_at = now() + interval '30 seconds'
 where id = (select id from subject);

select is(
  (select name from public.accounts where id = (select id from subject)),
  'edited on phone',
  'a newer client timestamp wins'
);

select is(
  (select updated_at from public.accounts where id = (select id from subject)),
  now() + interval '30 seconds',
  'and the client timestamp is kept, not overwritten with the server clock'
);

-- ---------------------------------------------------------------------------
-- A stale write loses - the whole point
-- ---------------------------------------------------------------------------

update public.accounts
   set name = 'edited on tablet while offline', updated_at = now() - interval '1 hour'
 where id = (select id from subject);

select is(
  (select name from public.accounts where id = (select id from subject)),
  'edited on phone',
  'a stale write does not clobber a newer edit'
);

select is(
  (select updated_at from public.accounts where id = (select id from subject)),
  now() + interval '30 seconds',
  'and it does not move updated_at backwards'
);

-- Every column of the stale write is discarded, not just the ones that clash.
update public.accounts
   set name = 'stale name',
       color = '#FF0000',
       is_archived = true,
       updated_at = now() - interval '2 hours'
 where id = (select id from subject);

select is(
  (select color from public.accounts where id = (select id from subject)),
  null,
  'a stale write is rejected whole - no column of it lands'
);

select is(
  (select is_archived from public.accounts where id = (select id from subject)),
  false,
  'including the ones the newer write never touched'
);

-- ---------------------------------------------------------------------------
-- Clock skew is clamped
-- ---------------------------------------------------------------------------

update public.accounts
   set name = 'device with a fast clock', updated_at = now() + interval '3 days'
 where id = (select id from subject);

select ok(
  (select updated_at from public.accounts where id = (select id from subject))
    <= now() + public.max_clock_skew(),
  'a client clock running fast cannot stamp a row far into the future'
);

select is(
  (select name from public.accounts where id = (select id from subject)),
  'device with a fast clock',
  'the write itself still applies'
);

select ok(
  public.max_clock_skew() > interval '0',
  'the skew allowance is positive'
);

-- After the clamp, a normal write with the current clock still wins.
update public.accounts
   set name = 'back to normal', updated_at = now() + public.max_clock_skew()
 where id = (select id from subject);

select is(
  (select name from public.accounts where id = (select id from subject)),
  'back to normal',
  'a subsequent write at the clamp ceiling is not treated as stale'
);

-- ---------------------------------------------------------------------------
-- The rule applies to every synced table, not just accounts
-- ---------------------------------------------------------------------------

update public.transactions
   set note = 'newer note', updated_at = now() + interval '1 minute'
 where user_id = '44444444-4444-4444-8444-444444444444' and type = 'expense';

update public.transactions
   set note = 'stale note', updated_at = now() - interval '1 minute'
 where user_id = '44444444-4444-4444-8444-444444444444' and type = 'expense';

select is(
  (select note from public.transactions
    where user_id = '44444444-4444-4444-8444-444444444444' and type = 'expense'),
  'newer note',
  'transactions resolve conflicts the same way'
);

update public.budgets
   set limit_paise = 2000000, updated_at = now() + interval '1 minute'
 where user_id = '44444444-4444-4444-8444-444444444444';

update public.budgets
   set limit_paise = 999, updated_at = now() - interval '1 minute'
 where user_id = '44444444-4444-4444-8444-444444444444';

select is(
  (select limit_paise from public.budgets
    where user_id = '44444444-4444-4444-8444-444444444444'),
  2000000::bigint,
  'budgets resolve conflicts the same way'
);

-- ---------------------------------------------------------------------------
-- A soft delete is an ordinary write, so it obeys the same rule
-- ---------------------------------------------------------------------------

update public.goals
   set name = 'renamed later', updated_at = now() + interval '5 minutes'
 where user_id = '44444444-4444-4444-8444-444444444444';

update public.goals
   set deleted_at = now(), updated_at = now() - interval '5 minutes'
 where user_id = '44444444-4444-4444-8444-444444444444';

select is(
  (select deleted_at from public.goals
    where user_id = '44444444-4444-4444-8444-444444444444'),
  null,
  'a stale delete does not remove a row that was edited more recently'
);

update public.goals
   set deleted_at = now(), updated_at = now() + interval '10 minutes'
 where user_id = '44444444-4444-4444-8444-444444444444';

select isnt(
  (select deleted_at from public.goals
    where user_id = '44444444-4444-4444-8444-444444444444'),
  null,
  'a current delete still works'
);

select * from finish();

rollback;
