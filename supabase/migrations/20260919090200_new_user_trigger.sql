-- When Supabase Auth creates a user, give them a profile and a starting set of
-- categories, so the app has something to show before the first sync.

create or replace function public.seed_default_categories(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  seeded integer;
begin
  insert into public.categories (user_id, name, type, icon, color, is_default)
  select
    target_user_id,
    seed.name,
    seed.type,
    seed.icon,
    seed.color,
    true
  from (
    values
      -- Expense ------------------------------------------------------------
      ('Food',              'expense', 'restaurant-outline',        '#B45309'),
      ('Groceries',         'expense', 'cart-outline',              '#15803D'),
      ('Rent',              'expense', 'home-outline',              '#4338CA'),
      ('Transport',         'expense', 'bus-outline',               '#0B6B62'),
      ('Fuel',              'expense', 'car-outline',               '#1D4ED8'),
      ('Shopping',          'expense', 'bag-handle-outline',        '#B91C1C'),
      ('Bills & Utilities', 'expense', 'receipt-outline',           '#0D8177'),
      ('EMI',               'expense', 'card-outline',              '#4F46E5'),
      ('Health',            'expense', 'medkit-outline',            '#DC2626'),
      ('Education',         'expense', 'school-outline',            '#1D4ED8'),
      ('Entertainment',     'expense', 'game-controller-outline',   '#7C3AED'),
      ('Travel',            'expense', 'airplane-outline',          '#0891B2'),
      ('Other',             'expense', 'ellipsis-horizontal-outline', '#64748B'),
      -- Income -------------------------------------------------------------
      ('Salary',            'income',  'wallet-outline',            '#15803D'),
      ('Freelance',         'income',  'briefcase-outline',         '#0B6B62'),
      ('Interest',          'income',  'trending-up-outline',       '#4338CA'),
      ('Refund',            'income',  'return-down-back-outline',  '#0D8177')
  ) as seed (name, type, icon, color)
  -- Idempotent: re-running never duplicates a user's defaults.
  where not exists (
    select 1
    from public.categories existing
    where existing.user_id = target_user_id
      and existing.name = seed.name
      and existing.type = seed.type
  );

  get diagnostics seeded = row_count;
  return seeded;
end;
$$;

comment on function public.seed_default_categories is
  'Seeds the default Indian category set for a user. Idempotent.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, user_id, full_name)
  values (
    new.id,
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;

  perform public.seed_default_categories(new.id);

  return new;
end;
$$;

comment on function public.handle_new_user is
  'AFTER INSERT on auth.users: creates the profile and seeds default categories.';

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- These run as the definer (the migration owner), never as the client.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
