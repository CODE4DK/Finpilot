-- The aggregation the Edge Function reads.
--
-- Written as one function rather than a dozen round trips from Deno: the
-- shape of what the AI feature is allowed to read lives here, in the schema,
-- next to the tables it reads - not scattered through a handler where a new
-- column could quietly join the payload.
--
-- Note what it does NOT select: no note, no account name, no goal name that
-- is not needed, no id. Transfers are excluded everywhere, because money
-- moved between your own accounts is neither income nor expense.
--
-- SECURITY DEFINER with a pinned search_path, executable only by the service
-- role. The caller passes the user id, and the Edge Function only ever passes
-- the id it read out of a verified JWT.

create or replace function public.ai_insight_aggregates(p_user_id uuid, p_month date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      date_trunc('month', p_month)::date as month_start,
      (date_trunc('month', p_month) + interval '1 month')::date as next_month,
      (date_trunc('month', p_month) - interval '1 month')::date as previous_month
  ),
  spans as (
    select
      b.*,
      (b.next_month - b.month_start) as days_in_month,
      case
        -- A month still in progress divides by the days lived so far, so the
        -- daily average does not read low all month and jump on the 31st.
        when current_date >= b.month_start and current_date < b.next_month
          then (current_date - b.month_start) + 1
        else (b.next_month - b.month_start)
      end as elapsed_days
    from bounds b
  ),
  current_totals as (
    select
      coalesce(sum(t.amount_paise) filter (where t.type = 'income'), 0) as income_paise,
      coalesce(sum(t.amount_paise) filter (where t.type = 'expense'), 0) as expense_paise,
      count(*) filter (where t.type = 'expense') as expense_count
    from public.transactions t, spans s
    where t.user_id = p_user_id
      and t.deleted_at is null
      and t.occurred_at >= s.month_start
      and t.occurred_at < s.next_month
  ),
  previous_totals as (
    select
      coalesce(sum(t.amount_paise) filter (where t.type = 'income'), 0) as income_paise,
      coalesce(sum(t.amount_paise) filter (where t.type = 'expense'), 0) as expense_paise,
      count(*) filter (where t.type = 'expense') as expense_count
    from public.transactions t, spans s
    where t.user_id = p_user_id
      and t.deleted_at is null
      and t.occurred_at >= s.previous_month
      and t.occurred_at < s.month_start
  ),
  current_categories as (
    select
      c.name as category_name,
      coalesce(sum(t.amount_paise), 0) as spent_paise,
      count(*) as txn_count
    from public.transactions t
    cross join spans s
    left join public.categories c
      on c.id = t.category_id and c.user_id = t.user_id and c.deleted_at is null
    where t.user_id = p_user_id
      and t.deleted_at is null
      and t.type = 'expense'
      and t.occurred_at >= s.month_start
      and t.occurred_at < s.next_month
    group by c.name
    order by 2 desc
  ),
  previous_categories as (
    select
      c.name as category_name,
      coalesce(sum(t.amount_paise), 0) as spent_paise,
      count(*) as txn_count
    from public.transactions t
    cross join spans s
    left join public.categories c
      on c.id = t.category_id and c.user_id = t.user_id and c.deleted_at is null
    where t.user_id = p_user_id
      and t.deleted_at is null
      and t.type = 'expense'
      and t.occurred_at >= s.previous_month
      and t.occurred_at < s.month_start
    group by c.name
  ),
  budget_status as (
    select
      c.name as category_name,
      b.limit_paise,
      coalesce((
        select sum(t.amount_paise)
        from public.transactions t, spans s
        where t.user_id = p_user_id
          and t.deleted_at is null
          and t.type = 'expense'
          and t.category_id = b.category_id
          and t.occurred_at >= s.month_start
          and t.occurred_at < s.next_month
      ), 0) as spent_paise
    from public.budgets b
    cross join spans s
    left join public.categories c
      on c.id = b.category_id and c.user_id = b.user_id and c.deleted_at is null
    where b.user_id = p_user_id
      and b.deleted_at is null
      and b.month = s.month_start
  ),
  goal_status as (
    select
      g.name,
      g.target_paise,
      g.target_date::text as target_date,
      coalesce((
        select sum(gc.amount_paise)
        from public.goal_contributions gc
        where gc.goal_id = g.id and gc.user_id = g.user_id and gc.deleted_at is null
      ), 0) as saved_paise
    from public.goals g
    where g.user_id = p_user_id
      and g.deleted_at is null
      and g.status = 'active'
    order by g.created_at
  )
  select jsonb_build_object(
    'elapsedDays', (select elapsed_days from spans),
    'daysInMonth', (select days_in_month from spans),
    'current', (select to_jsonb(c) from current_totals c),
    'previous', (select to_jsonb(p) from previous_totals p),
    'currentCategories', coalesce((select jsonb_agg(to_jsonb(cc)) from current_categories cc), '[]'::jsonb),
    'previousCategories', coalesce((select jsonb_agg(to_jsonb(pc)) from previous_categories pc), '[]'::jsonb),
    'budgets', coalesce((select jsonb_agg(to_jsonb(bs)) from budget_status bs), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(to_jsonb(gs)) from goal_status gs), '[]'::jsonb)
  );
$$;

comment on function public.ai_insight_aggregates is
  'Aggregates for the generate-insights Edge Function. Amounts and category names only - never a note, an account name or an id.';

-- Only the service role, inside the Edge Function, may run it.
revoke all on function public.ai_insight_aggregates(uuid, date) from public, anon, authenticated;
grant execute on function public.ai_insight_aggregates(uuid, date) to service_role;
