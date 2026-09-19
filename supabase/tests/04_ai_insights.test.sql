-- The AI insight request log is server-side only.
--
-- It is the rate limit and the audit trail for the one feature that sends
-- data off the device, so the interesting assertions are all about what a
-- client *cannot* do with it.

begin;

select plan(12);

\i supabase/tests/helpers/fixtures.sql

select tests.create_user('11111111-1111-4111-8111-111111111111', 'alice@example.com');

select has_table('public', 'ai_insight_requests', 'the request log exists');

select has_column('public', 'ai_insight_requests', 'user_id', 'the log is keyed by user');
select has_column('public', 'ai_insight_requests', 'month', 'the log records the month asked for');
select has_column('public', 'ai_insight_requests', 'status', 'the log records the outcome');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.ai_insight_requests'::regclass),
  'RLS is enabled on the request log'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.ai_insight_requests'::regclass),
  'RLS is forced on the request log, owner included'
);

-- No policies at all: there is nothing here a signed-in user may do.
select is(
  (select count(*)::int from pg_policies where tablename = 'ai_insight_requests'),
  0,
  'the request log has no policies'
);

select is(
  (select count(*)::int
   from information_schema.role_table_grants
   where table_name = 'ai_insight_requests' and grantee in ('anon', 'authenticated')),
  0,
  'neither anon nor authenticated has any privilege on the request log'
);

-- It must never reach a device: it is not replicated.
select is(
  (select count(*)::int
   from pg_publication_tables
   where pubname = 'powersync' and tablename = 'ai_insight_requests'),
  0,
  'the request log is not in the powersync publication'
);
select is(
  (select count(*)::int from pg_publication_tables where pubname = 'powersync'),
  9,
  'the publication still carries exactly the nine synced tables'
);

-- The status vocabulary is closed, so a typo cannot silently become a new
-- outcome the rate limit does not count.
select throws_ok(
  $$insert into public.ai_insight_requests (user_id, month, status)
    values ('11111111-1111-4111-8111-111111111111', '2026-09-01', 'whatever')$$,
  '23514',
  null,
  'an unknown status is rejected'
);

select lives_ok(
  $$insert into public.ai_insight_requests (user_id, month, status)
    values ('11111111-1111-4111-8111-111111111111', '2026-09-01', 'succeeded')$$,
  'a known status is accepted'
);

select * from finish();

rollback;
