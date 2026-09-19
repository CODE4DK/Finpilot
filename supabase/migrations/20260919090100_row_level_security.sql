-- Row Level Security.
--
-- The rule is the same on every table: a user sees and writes only rows whose
-- user_id matches auth.uid(). There is deliberately NO delete policy and the
-- DELETE privilege is revoked - clients soft-delete by setting deleted_at, so
-- PowerSync can replicate the deletion to the user's other devices.

do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles', 'accounts', 'categories', 'recurring_rules', 'transactions',
    'budgets', 'goals', 'goal_contributions', 'insights'
  ]
  loop
    execute format('alter table public.%I enable row level security', target);
    -- Applies the policies to the table owner too, so a mistake in a
    -- SECURITY DEFINER function cannot quietly read across users.
    execute format('alter table public.%I force row level security', target);

    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      target || '_select_own', target
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      target || '_insert_own', target
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      target || '_update_own', target
    );

    -- Hard deletes are not available to clients at all.
    execute format('revoke delete on public.%I from anon, authenticated', target);
  end loop;
end;
$$;

-- Anonymous callers have no business in any of these tables.
revoke all on all tables in schema public from anon;

-- The profile row is created by the auth trigger, not by the client.
revoke insert on public.profiles from authenticated;
drop policy profiles_insert_own on public.profiles;

comment on policy transactions_select_own on public.transactions is
  'Soft-deleted rows stay visible to their owner so PowerSync can replicate the delete.';
