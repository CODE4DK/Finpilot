-- FinPilot initial schema.
--
-- Conventions enforced here (see CLAUDE.md):
--   * UUID primary keys are supplied by the client - an offline-first app
--     cannot wait for the server to assign one. The DEFAULT is only a safety
--     net for server-side inserts.
--   * Money is always an integer number of paise (bigint), never a float.
--   * Every table carries user_id, created_at, updated_at, deleted_at.
--   * Deletes are soft: set deleted_at. There is no DELETE policy for clients.
--   * Enumerated values are TEXT + CHECK rather than Postgres enums: PowerSync
--     mirrors these tables into SQLite, which has no enum type, and altering a
--     Postgres enum later is far more disruptive than editing a CHECK.

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Keeps updated_at honest regardless of what the client sends.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'BEFORE UPDATE trigger: stamps updated_at with the server clock.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Duplicated from id so that every table in the schema - and therefore every
  -- RLS policy and PowerSync sync rule - can key off user_id uniformly.
  user_id uuid not null,
  full_name text,
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  onboarding_completed boolean not null default false,
  ai_insights_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_user_id_matches_id check (user_id = id),
  constraint profiles_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint profiles_full_name_length check (full_name is null or char_length(full_name) <= 120)
);

comment on table public.profiles is 'One row per auth user; created by the on_auth_user_created trigger.';

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  name text not null,
  opening_balance_paise bigint not null default 0,
  color text,
  icon text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint accounts_type_valid check (type in ('cash', 'bank', 'card', 'upi_wallet')),
  constraint accounts_name_not_blank check (char_length(btrim(name)) between 1 and 80),
  constraint accounts_color_format check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Lets child tables reference (id, user_id) so a row can never point at
  -- another user's account.
  constraint accounts_id_user_id_key unique (id, user_id)
);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  icon text,
  color text,
  is_default boolean not null default false,
  parent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint categories_type_valid check (type in ('income', 'expense')),
  constraint categories_name_not_blank check (char_length(btrim(name)) between 1 and 60),
  constraint categories_color_format check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint categories_parent_not_self check (parent_id is null or parent_id <> id),
  constraint categories_id_user_id_key unique (id, user_id),
  constraint categories_parent_same_owner
    foreign key (parent_id, user_id) references public.categories (id, user_id) on update cascade
);

-- ---------------------------------------------------------------------------
-- recurring_rules
-- ---------------------------------------------------------------------------

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Transaction template ------------------------------------------------
  type text not null,
  amount_paise bigint not null,
  account_id uuid not null,
  to_account_id uuid,
  category_id uuid,
  note text,
  -- Schedule -------------------------------------------------------------
  frequency text not null,
  "interval" integer not null default 1,
  next_run_at timestamptz not null,
  end_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint recurring_rules_type_valid check (type in ('income', 'expense', 'transfer')),
  constraint recurring_rules_amount_positive check (amount_paise > 0),
  constraint recurring_rules_frequency_valid
    check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  constraint recurring_rules_interval_positive check ("interval" > 0),
  constraint recurring_rules_end_after_start check (end_at is null or end_at >= next_run_at),
  constraint recurring_rules_note_length check (note is null or char_length(note) <= 280),
  -- A transfer needs a destination that differs from the source; anything
  -- else must not have one.
  constraint recurring_rules_transfer_shape check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (type <> 'transfer' and to_account_id is null)
  ),
  -- Transfers move money between accounts and are not categorised.
  constraint recurring_rules_category_shape check (
    (type = 'transfer' and category_id is null)
    or (type <> 'transfer' and category_id is not null)
  ),
  constraint recurring_rules_id_user_id_key unique (id, user_id),
  constraint recurring_rules_account_same_owner
    foreign key (account_id, user_id) references public.accounts (id, user_id) on update cascade,
  constraint recurring_rules_to_account_same_owner
    foreign key (to_account_id, user_id) references public.accounts (id, user_id) on update cascade,
  constraint recurring_rules_category_same_owner
    foreign key (category_id, user_id) references public.categories (id, user_id) on update cascade
);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  -- Always positive: direction comes from `type`, never from the sign.
  amount_paise bigint not null,
  account_id uuid not null,
  to_account_id uuid,
  category_id uuid,
  note text,
  occurred_at timestamptz not null default now(),
  recurring_rule_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transactions_type_valid check (type in ('income', 'expense', 'transfer')),
  constraint transactions_amount_positive check (amount_paise > 0),
  constraint transactions_note_length check (note is null or char_length(note) <= 280),
  constraint transactions_transfer_shape check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (type <> 'transfer' and to_account_id is null)
  ),
  constraint transactions_category_shape check (
    (type = 'transfer' and category_id is null)
    or (type <> 'transfer' and category_id is not null)
  ),
  constraint transactions_id_user_id_key unique (id, user_id),
  constraint transactions_account_same_owner
    foreign key (account_id, user_id) references public.accounts (id, user_id) on update cascade,
  constraint transactions_to_account_same_owner
    foreign key (to_account_id, user_id) references public.accounts (id, user_id) on update cascade,
  constraint transactions_category_same_owner
    foreign key (category_id, user_id) references public.categories (id, user_id) on update cascade,
  constraint transactions_recurring_rule_same_owner
    foreign key (recurring_rule_id, user_id)
      references public.recurring_rules (id, user_id) on update cascade
);

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null,
  -- Always the first day of the month it budgets for.
  month date not null,
  limit_paise bigint not null,
  alert_80_sent boolean not null default false,
  alert_100_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint budgets_limit_positive check (limit_paise > 0),
  constraint budgets_month_is_first_of_month check (month = date_trunc('month', month)::date),
  constraint budgets_id_user_id_key unique (id, user_id),
  constraint budgets_category_same_owner
    foreign key (category_id, user_id) references public.categories (id, user_id) on update cascade
);

-- One live budget per category per month. Soft-deleted rows are excluded so a
-- category can be re-budgeted after its budget is deleted.
create unique index budgets_user_category_month_key
  on public.budgets (user_id, category_id, month)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_paise bigint not null,
  target_date date,
  icon text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint goals_target_positive check (target_paise > 0),
  constraint goals_status_valid check (status in ('active', 'completed', 'archived')),
  constraint goals_name_not_blank check (char_length(btrim(name)) between 1 and 80),
  constraint goals_id_user_id_key unique (id, user_id)
);

-- ---------------------------------------------------------------------------
-- goal_contributions
-- ---------------------------------------------------------------------------

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null,
  amount_paise bigint not null,
  contributed_at timestamptz not null default now(),
  account_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint goal_contributions_amount_positive check (amount_paise > 0),
  constraint goal_contributions_id_user_id_key unique (id, user_id),
  constraint goal_contributions_goal_same_owner
    foreign key (goal_id, user_id) references public.goals (id, user_id) on update cascade,
  constraint goal_contributions_account_same_owner
    foreign key (account_id, user_id) references public.accounts (id, user_id) on update cascade
);

-- ---------------------------------------------------------------------------
-- insights
-- ---------------------------------------------------------------------------

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null,
  summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint insights_month_is_first_of_month check (month = date_trunc('month', month)::date),
  constraint insights_summary_is_object check (jsonb_typeof(summary) = 'object'),
  constraint insights_id_user_id_key unique (id, user_id)
);

create unique index insights_user_month_key
  on public.insights (user_id, month)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Every table is queried by owner first; the partial variants serve the common
-- "live rows only" reads without bloating on soft-deleted history.
create index profiles_user_id_idx on public.profiles (user_id);

create index accounts_user_id_idx on public.accounts (user_id);
create index accounts_user_live_idx on public.accounts (user_id) where deleted_at is null;

create index categories_user_id_idx on public.categories (user_id);
create index categories_user_type_idx on public.categories (user_id, type) where deleted_at is null;
create index categories_parent_id_idx on public.categories (parent_id, user_id);

create index recurring_rules_user_id_idx on public.recurring_rules (user_id);
create index recurring_rules_next_run_idx
  on public.recurring_rules (next_run_at)
  where deleted_at is null and is_active;
create index recurring_rules_account_id_idx on public.recurring_rules (account_id, user_id);
create index recurring_rules_to_account_id_idx on public.recurring_rules (to_account_id, user_id);
create index recurring_rules_category_id_idx on public.recurring_rules (category_id, user_id);

create index transactions_user_id_idx on public.transactions (user_id);
-- The list screen: this user's transactions, newest first.
create index transactions_user_occurred_at_idx
  on public.transactions (user_id, occurred_at desc)
  where deleted_at is null;
create index transactions_occurred_at_idx on public.transactions (occurred_at desc);
create index transactions_account_id_idx on public.transactions (account_id, user_id);
create index transactions_to_account_id_idx on public.transactions (to_account_id, user_id);
create index transactions_category_id_idx on public.transactions (category_id, user_id);
create index transactions_recurring_rule_id_idx on public.transactions (recurring_rule_id, user_id);

create index budgets_user_id_idx on public.budgets (user_id);
create index budgets_user_month_idx on public.budgets (user_id, month) where deleted_at is null;
create index budgets_category_id_idx on public.budgets (category_id, user_id);

create index goals_user_id_idx on public.goals (user_id);
create index goals_user_status_idx on public.goals (user_id, status) where deleted_at is null;

create index goal_contributions_user_id_idx on public.goal_contributions (user_id);
create index goal_contributions_goal_id_idx on public.goal_contributions (goal_id, user_id);
create index goal_contributions_account_id_idx on public.goal_contributions (account_id, user_id);
create index goal_contributions_contributed_at_idx
  on public.goal_contributions (user_id, contributed_at desc)
  where deleted_at is null;

create index insights_user_id_idx on public.insights (user_id);
create index insights_user_month_idx on public.insights (user_id, month desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles', 'accounts', 'categories', 'recurring_rules', 'transactions',
    'budgets', 'goals', 'goal_contributions', 'insights'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      target
    );
  end loop;
end;
$$;
