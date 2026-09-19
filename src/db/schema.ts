import { Schema, Table, column } from '@powersync/react-native';

/**
 * The local SQLite schema, mirroring the Supabase tables listed in the
 * `powersync` publication (see supabase/migrations and powersync/sync-rules.yaml).
 *
 * Three translations happen between Postgres and SQLite:
 *
 *   * `id` is implicit. PowerSync gives every table a TEXT `id` primary key,
 *     so it is never declared here.
 *   * Money stays an INTEGER count of paise. SQLite integers are 64-bit, and
 *     every realistic balance is far inside Number.MAX_SAFE_INTEGER.
 *   * SQLite has no boolean or timestamp type. Booleans arrive as INTEGER 0/1
 *     and timestamps as TEXT (ISO-8601 from Postgres), which is why the
 *     helpers in `src/db/row-mappers.ts` exist.
 *
 * Indexes mirror the hot Postgres ones: everything is read by owner, and
 * transactions are read by owner and date.
 */

const OWNERSHIP_COLUMNS = {
  user_id: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
} as const;

export const profiles = new Table(
  {
    ...OWNERSHIP_COLUMNS,
    full_name: column.text,
    currency: column.text,
    timezone: column.text,
    onboarding_completed: column.integer,
    ai_insights_opt_in: column.integer,
  },
  { indexes: { by_user: ['user_id'] } },
);

export const accounts = new Table(
  {
    ...OWNERSHIP_COLUMNS,
    type: column.text,
    name: column.text,
    opening_balance_paise: column.integer,
    color: column.text,
    icon: column.text,
    is_archived: column.integer,
  },
  { indexes: { by_user: ['user_id'] } },
);

export const categories = new Table(
  {
    ...OWNERSHIP_COLUMNS,
    name: column.text,
    type: column.text,
    icon: column.text,
    color: column.text,
    is_default: column.integer,
    parent_id: column.text,
  },
  { indexes: { by_user: ['user_id'], by_parent: ['parent_id'] } },
);

export const recurring_rules = new Table(
  {
    ...OWNERSHIP_COLUMNS,
    type: column.text,
    amount_paise: column.integer,
    account_id: column.text,
    to_account_id: column.text,
    category_id: column.text,
    note: column.text,
    frequency: column.text,
    interval: column.integer,
    next_run_at: column.text,
    end_at: column.text,
    is_active: column.integer,
  },
  { indexes: { by_user: ['user_id'], by_next_run: ['next_run_at'] } },
);

export const transactions = new Table(
  {
    ...OWNERSHIP_COLUMNS,
    type: column.text,
    amount_paise: column.integer,
    account_id: column.text,
    to_account_id: column.text,
    category_id: column.text,
    note: column.text,
    occurred_at: column.text,
    recurring_rule_id: column.text,
  },
  {
    indexes: {
      by_user: ['user_id'],
      // The transaction list: this user's rows, newest first.
      by_occurred_at: ['occurred_at'],
      by_account: ['account_id'],
      by_category: ['category_id'],
    },
  },
);

export const budgets = new Table(
  {
    ...OWNERSHIP_COLUMNS,
    category_id: column.text,
    month: column.text,
    limit_paise: column.integer,
    alert_80_sent: column.integer,
    alert_100_sent: column.integer,
  },
  { indexes: { by_user: ['user_id'], by_month: ['month'], by_category: ['category_id'] } },
);

export const goals = new Table(
  {
    ...OWNERSHIP_COLUMNS,
    name: column.text,
    target_paise: column.integer,
    target_date: column.text,
    icon: column.text,
    status: column.text,
  },
  { indexes: { by_user: ['user_id'], by_status: ['status'] } },
);

export const goal_contributions = new Table(
  {
    ...OWNERSHIP_COLUMNS,
    goal_id: column.text,
    amount_paise: column.integer,
    contributed_at: column.text,
    account_id: column.text,
  },
  { indexes: { by_user: ['user_id'], by_goal: ['goal_id'] } },
);

export const insights = new Table(
  {
    ...OWNERSHIP_COLUMNS,
    month: column.text,
    // jsonb arrives as a TEXT blob; parse at the repository boundary.
    summary: column.text,
    generated_at: column.text,
  },
  { indexes: { by_user: ['user_id'], by_month: ['month'] } },
);

export const AppSchema = new Schema({
  profiles,
  accounts,
  categories,
  recurring_rules,
  transactions,
  budgets,
  goals,
  goal_contributions,
  insights,
});

export type AppDatabase = (typeof AppSchema)['types'];

/** The tables that sync, in the order the publication lists them. */
export const SYNCED_TABLES = [
  'profiles',
  'accounts',
  'categories',
  'recurring_rules',
  'transactions',
  'budgets',
  'goals',
  'goal_contributions',
  'insights',
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];
