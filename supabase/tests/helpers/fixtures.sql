-- Test fixtures shared by the pgTAP suites: two users with a full set of rows
-- each, plus helpers for acting as one of them.

create schema if not exists tests;

create or replace function tests.create_user(target_id uuid, target_email text)
returns uuid
language plpgsql
as $$
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (target_id, target_email, jsonb_build_object('full_name', split_part(target_email, '@', 1)))
  on conflict (id) do nothing;
  return target_id;
end;
$$;

-- Become an authenticated client for this user: the role PostgREST uses plus
-- the JWT claims RLS reads.
-- Sets the JWT claims RLS reads. The companion `set local role authenticated`
-- is written inline in each test file so the role change is unambiguously
-- scoped to the test's transaction.
create or replace function tests.authenticate_as(target_id uuid)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', target_id, 'role', 'authenticated')::text,
    true
  );
  select null::void;
$$;

create or replace function tests.clear_authentication()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '', true);
  select null::void;
$$;

-- Gives `target_id` one account, one category, and one row in every other
-- table, all consistent with the schema's constraints.
create or replace function tests.seed_user_data(target_id uuid, tag text)
returns void
language plpgsql
as $$
declare
  account_id uuid := gen_random_uuid();
  other_account_id uuid := gen_random_uuid();
  category_id uuid;
  rule_id uuid := gen_random_uuid();
  goal_id uuid := gen_random_uuid();
begin
  insert into public.accounts (id, user_id, type, name)
  values (account_id, target_id, 'bank', tag || ' bank'),
         (other_account_id, target_id, 'cash', tag || ' cash');

  -- The auth trigger already seeded the defaults; reuse one of them.
  select id into category_id
  from public.categories
  where user_id = target_id and type = 'expense'
  order by name
  limit 1;

  insert into public.recurring_rules
    (id, user_id, type, amount_paise, account_id, category_id, frequency, "interval", next_run_at)
  values
    (rule_id, target_id, 'expense', 250000, account_id, category_id, 'monthly', 1, now() + interval '1 day');

  insert into public.transactions
    (user_id, type, amount_paise, account_id, category_id, note, occurred_at, recurring_rule_id)
  values
    (target_id, 'expense', 184550, account_id, category_id, tag || ' groceries', now(), rule_id);

  insert into public.transactions
    (user_id, type, amount_paise, account_id, to_account_id, occurred_at)
  values
    (target_id, 'transfer', 500000, account_id, other_account_id, now());

  insert into public.budgets (user_id, category_id, month, limit_paise)
  values (target_id, category_id, date_trunc('month', now())::date, 1000000);

  insert into public.goals (id, user_id, name, target_paise)
  values (goal_id, target_id, tag || ' emergency fund', 50000000);

  insert into public.goal_contributions (user_id, goal_id, amount_paise, account_id)
  values (target_id, goal_id, 1000000, account_id);

  insert into public.insights (user_id, month, summary)
  values (target_id, date_trunc('month', now())::date, jsonb_build_object('owner', tag));
end;
$$;
