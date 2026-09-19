/**
 * Report aggregation, as SQL over the local database.
 *
 * Every number on the Reports tab is summed by SQLite on the device, so the
 * screen works with the radio off and does not depend on a server-side view.
 * The builders return `{ sql, parameters }` rather than executing, exactly
 * like the repositories do, so the hooks can hand the same statement to
 * PowerSync's `useQuery` and get a reactive result.
 *
 * Two rules run through all of them:
 *   * transfers are excluded - money moved between your own accounts is
 *     neither income nor expense (see `src/features/ledger/README.md`);
 *   * soft-deleted rows are excluded, because a delete is a `deleted_at`
 *     stamp and the row is still in the table.
 */

import type { Period } from '@/features/ledger/period';

import type { MonthBucket } from './periods';

export interface ReportQuery {
  sql: string;
  parameters: unknown[];
}

/** `WHERE` shared by every report query. */
const LIVE = 'user_id = ? AND deleted_at IS NULL';

export interface PeriodTotalsRow {
  income_paise: number;
  expense_paise: number;
  expense_count: number;
}

/** Income and expense for the whole period - the header figures. */
export function periodTotalsQuery(userId: string, period: Period): ReportQuery {
  return {
    sql: `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount_paise ELSE 0 END), 0) AS income_paise,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_paise ELSE 0 END), 0) AS expense_paise,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN 1 ELSE 0 END), 0) AS expense_count
      FROM transactions
      WHERE ${LIVE} AND occurred_at >= ? AND occurred_at < ?
    `,
    parameters: [userId, period.from, period.to],
  };
}

export interface CategorySpendRow {
  category_id: string | null;
  spent_paise: number;
  txn_count: number;
}

/** Expense per category for the period, biggest first - the donut's input. */
export function categorySpendQuery(userId: string, period: Period): ReportQuery {
  return {
    sql: `
      SELECT
        category_id,
        COALESCE(SUM(amount_paise), 0) AS spent_paise,
        COUNT(*) AS txn_count
      FROM transactions
      WHERE ${LIVE} AND type = 'expense' AND occurred_at >= ? AND occurred_at < ?
      GROUP BY category_id
      ORDER BY spent_paise DESC
    `,
    parameters: [userId, period.from, period.to],
  };
}

export interface MonthlyTotalsRow {
  month_key: string;
  income_paise: number;
  expense_paise: number;
}

/**
 * Income and expense per month - the trend chart's bars.
 *
 * Built as a UNION of one aggregate per month rather than `GROUP BY
 * strftime(...)`, because `occurred_at` is a UTC instant and the buckets have
 * to be *local* months. Passing explicit local boundaries keeps that correct
 * without asking SQLite to know the device's timezone, and every month yields
 * a row even when it is empty, so a quiet month draws a zero bar instead of
 * vanishing from the axis.
 */
export function monthlyTotalsQuery(userId: string, buckets: MonthBucket[]): ReportQuery {
  if (buckets.length === 0) {
    return { sql: 'SELECT NULL AS month_key WHERE 0', parameters: [] };
  }

  const parameters: unknown[] = [];
  const selects = buckets.map((bucket) => {
    parameters.push(bucket.key, userId, bucket.from, bucket.to);
    return `
      SELECT
        ? AS month_key,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount_paise ELSE 0 END), 0) AS income_paise,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_paise ELSE 0 END), 0) AS expense_paise
      FROM transactions
      WHERE ${LIVE} AND occurred_at >= ? AND occurred_at < ?
    `;
  });

  return { sql: selects.join('\nUNION ALL\n'), parameters };
}

export interface CategoryChangeRow {
  category_id: string | null;
  current_paise: number;
  previous_paise: number;
}

/**
 * This period against the one before it, per category, in a single pass.
 *
 * A category that existed in only one of the two windows still comes back,
 * with a zero on the other side - which is the interesting case, not an edge
 * one: "you spent nothing on this last month" is the story.
 */
export function categoryChangeQuery(
  userId: string,
  current: Period,
  previous: Period,
): ReportQuery {
  return {
    sql: `
      SELECT
        category_id,
        COALESCE(SUM(CASE WHEN occurred_at >= ? AND occurred_at < ? THEN amount_paise ELSE 0 END), 0) AS current_paise,
        COALESCE(SUM(CASE WHEN occurred_at >= ? AND occurred_at < ? THEN amount_paise ELSE 0 END), 0) AS previous_paise
      FROM transactions
      WHERE ${LIVE}
        AND type = 'expense'
        AND occurred_at >= ?
        AND occurred_at < ?
      GROUP BY category_id
      HAVING current_paise > 0 OR previous_paise > 0
      ORDER BY current_paise DESC
    `,
    parameters: [
      current.from,
      current.to,
      previous.from,
      previous.to,
      userId,
      // One scan across both windows; they are contiguous, so the outer bounds
      // are the earlier start and the later end.
      previous.from < current.from ? previous.from : current.from,
      previous.to > current.to ? previous.to : current.to,
    ],
  };
}

export interface TopExpenseRow {
  id: string;
  amount_paise: number;
  note: string | null;
  occurred_at: string;
  category_id: string | null;
  account_id: string;
}

/** The largest single expenses in the period. */
export function topExpensesQuery(userId: string, period: Period, limit = 5): ReportQuery {
  return {
    sql: `
      SELECT id, amount_paise, note, occurred_at, category_id, account_id
      FROM transactions
      WHERE ${LIVE} AND type = 'expense' AND occurred_at >= ? AND occurred_at < ?
      ORDER BY amount_paise DESC, occurred_at DESC
      LIMIT ?
    `,
    parameters: [userId, period.from, period.to, limit],
  };
}

export interface ExportRow {
  occurred_at: string;
  type: string;
  amount_paise: number;
  category_name: string | null;
  account_name: string | null;
  to_account_name: string | null;
  note: string | null;
}

/**
 * Every transaction in the period, with names resolved, for the CSV export.
 * Transfers are included here - the export is a statement, not an analysis,
 * and a missing transfer makes the account columns impossible to reconcile.
 */
export function exportRowsQuery(userId: string, period: Period): ReportQuery {
  return {
    sql: `
      SELECT
        t.occurred_at AS occurred_at,
        t.type AS type,
        t.amount_paise AS amount_paise,
        c.name AS category_name,
        a.name AS account_name,
        d.name AS to_account_name,
        t.note AS note
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
      LEFT JOIN accounts a ON a.id = t.account_id AND a.user_id = t.user_id
      LEFT JOIN accounts d ON d.id = t.to_account_id AND d.user_id = t.user_id
      WHERE t.user_id = ? AND t.deleted_at IS NULL AND t.occurred_at >= ? AND t.occurred_at < ?
      ORDER BY t.occurred_at ASC
    `,
    parameters: [userId, period.from, period.to],
  };
}
