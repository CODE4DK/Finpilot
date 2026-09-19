import type { TransactionType } from '@/db/enums';

import { BaseRepository } from './base';
import type { RepositoryContext, SyncedRow } from './types';

export interface TransactionRow extends SyncedRow {
  type: string;
  amount_paise: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note: string | null;
  occurred_at: string;
  recurring_rule_id: string | null;
}

export interface TransactionInsert extends Record<string, unknown> {
  type: TransactionType;
  amount_paise: number;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  note?: string | null;
  occurred_at?: string;
  recurring_rule_id?: string | null;
}

export interface TransactionFilters {
  /** ISO-8601, inclusive. */
  from?: string;
  /** ISO-8601, exclusive - so a month filter is [1st, next 1st). */
  to?: string;
  types?: TransactionType[];
  accountIds?: string[];
  categoryIds?: string[];
  /** Case-insensitive substring of the note. */
  search?: string;
  minAmountPaise?: number;
  maxAmountPaise?: number;
  limit?: number;
  offset?: number;
}

export class TransactionsRepository extends BaseRepository<TransactionRow, TransactionInsert> {
  constructor(context: RepositoryContext) {
    super('transactions', context);
  }

  /**
   * Builds the filtered query. Returned rather than executed so the hook layer
   * can hand the identical SQL to PowerSync's `useQuery` and get a reactive
   * result instead of a one-off read.
   */
  listQuery(filters: TransactionFilters = {}): { sql: string; parameters: unknown[] } {
    const clauses: string[] = [];
    const parameters: unknown[] = [this.userId];

    if (filters.from) {
      clauses.push('occurred_at >= ?');
      parameters.push(filters.from);
    }
    if (filters.to) {
      clauses.push('occurred_at < ?');
      parameters.push(filters.to);
    }
    if (filters.types?.length) {
      clauses.push(`type IN (${filters.types.map(() => '?').join(', ')})`);
      parameters.push(...filters.types);
    }
    if (filters.accountIds?.length) {
      const placeholders = filters.accountIds.map(() => '?').join(', ');
      // A transfer belongs to both of its accounts.
      clauses.push(`(account_id IN (${placeholders}) OR to_account_id IN (${placeholders}))`);
      parameters.push(...filters.accountIds, ...filters.accountIds);
    }
    if (filters.categoryIds?.length) {
      clauses.push(`category_id IN (${filters.categoryIds.map(() => '?').join(', ')})`);
      parameters.push(...filters.categoryIds);
    }
    if (filters.search) {
      clauses.push('note LIKE ? ESCAPE ?');
      parameters.push(`%${escapeLike(filters.search)}%`, LIKE_ESCAPE);
    }
    if (typeof filters.minAmountPaise === 'number') {
      clauses.push('amount_paise >= ?');
      parameters.push(filters.minAmountPaise);
    }
    if (typeof filters.maxAmountPaise === 'number') {
      clauses.push('amount_paise <= ?');
      parameters.push(filters.maxAmountPaise);
    }

    let sql = `SELECT * FROM transactions ${this.liveWhere(clauses.join(' AND ') || undefined)} ORDER BY occurred_at DESC, created_at DESC`;

    if (typeof filters.limit === 'number') {
      sql += ' LIMIT ?';
      parameters.push(filters.limit);
      if (typeof filters.offset === 'number') {
        sql += ' OFFSET ?';
        parameters.push(filters.offset);
      }
    }

    return { sql, parameters };
  }

  override async list(): Promise<TransactionRow[]> {
    const { sql, parameters } = this.listQuery();
    return this.db.getAll<TransactionRow>(sql, parameters);
  }

  async listFiltered(filters: TransactionFilters = {}): Promise<TransactionRow[]> {
    const { sql, parameters } = this.listQuery(filters);
    return this.db.getAll<TransactionRow>(sql, parameters);
  }

  /** Income and expense totals for a period - the home screen summary. */
  totalsQuery(from: string, to: string): { sql: string; parameters: unknown[] } {
    return {
      sql: `
        SELECT
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount_paise ELSE 0 END), 0) AS income_paise,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_paise ELSE 0 END), 0) AS expense_paise
        FROM transactions
        ${this.liveWhere('occurred_at >= ? AND occurred_at < ?')}
      `,
      parameters: [this.userId, from, to],
    };
  }

  async totals(from: string, to: string): Promise<{ income_paise: number; expense_paise: number }> {
    const { sql, parameters } = this.totalsQuery(from, to);
    const row = await this.db.getOptional<{ income_paise: number; expense_paise: number }>(
      sql,
      parameters,
    );
    return row ?? { income_paise: 0, expense_paise: 0 };
  }

  /** Spend per category for a period - budgets and the reports screen. */
  spendByCategoryQuery(from: string, to: string): { sql: string; parameters: unknown[] } {
    return {
      sql: `
        SELECT category_id, COALESCE(SUM(amount_paise), 0) AS spent_paise
        FROM transactions
        ${this.liveWhere("type = 'expense' AND occurred_at >= ? AND occurred_at < ?")}
        GROUP BY category_id
        ORDER BY spent_paise DESC
      `,
      parameters: [this.userId, from, to],
    };
  }

  async spendByCategory(
    from: string,
    to: string,
  ): Promise<{ category_id: string | null; spent_paise: number }[]> {
    const { sql, parameters } = this.spendByCategoryQuery(from, to);
    return this.db.getAll(sql, parameters);
  }

  /**
   * The categories this user reached for most recently. Feeds the Add screen's
   * grid, where the ordering is the difference between two taps and three.
   */
  recentCategoriesQuery(limit = 6): { sql: string; parameters: unknown[] } {
    return {
      sql: `
        SELECT category_id, MAX(occurred_at) AS last_used_at, COUNT(*) AS uses
        FROM transactions
        ${this.liveWhere('category_id IS NOT NULL')}
        GROUP BY category_id
        ORDER BY last_used_at DESC
        LIMIT ?
      `,
      parameters: [this.userId, limit],
    };
  }

  async recentCategories(
    limit = 6,
  ): Promise<{ category_id: string | null; last_used_at: string; uses: number }[]> {
    const { sql, parameters } = this.recentCategoriesQuery(limit);
    return this.db.getAll(sql, parameters);
  }

  /** The account the user last saved against - the Add screen's default. */
  async lastUsedAccountId(): Promise<string | null> {
    const row = await this.db.getOptional<{ account_id: string }>(
      `SELECT account_id FROM transactions ${this.liveWhere()} ORDER BY created_at DESC LIMIT 1`,
      [this.userId],
    );
    return row?.account_id ?? null;
  }

  /**
   * Re-creates a deleted transaction with its original id, for Undo. A fresh
   * `updated_at` is what makes the resurrection win the last-write-wins
   * comparison against the delete that is already on its way to the server.
   */
  async restore(row: TransactionRow): Promise<void> {
    await this.insert({
      id: row.id,
      type: row.type as TransactionInsert['type'],
      amount_paise: row.amount_paise,
      account_id: row.account_id,
      to_account_id: row.to_account_id,
      category_id: row.category_id,
      note: row.note,
      occurred_at: row.occurred_at,
      recurring_rule_id: row.recurring_rule_id,
    });
  }

  /**
   * Writes a generated occurrence, ignoring it if this device already has it.
   * The id is deterministic (see src/features/recurring/generate.ts), so this
   * is what makes catch-up idempotent.
   */
  async insertGenerated(values: TransactionInsert & { id: string }): Promise<void> {
    const timestamp = new Date(this.now()).toISOString();
    const { id, ...rest } = values;
    const columns = [
      'id',
      'user_id',
      'created_at',
      'updated_at',
      'deleted_at',
      ...Object.keys(rest),
    ];
    const placeholders = columns.map(() => '?').join(', ');

    await this.db.execute(
      `INSERT OR IGNORE INTO transactions (${columns.join(', ')}) VALUES (${placeholders})`,
      [id, this.userId, timestamp, timestamp, null, ...Object.values(rest)],
    );
  }

  override async insert(values: TransactionInsert & { id?: string }): Promise<string> {
    // occurred_at defaults to now, so the caller only sets it for a backdated
    // entry.
    return super.insert({ occurred_at: new Date(this.now()).toISOString(), ...values });
  }
}

const LIKE_ESCAPE = '\\';

/** Stops a user's `%` or `_` from turning a search into a wildcard. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `${LIKE_ESCAPE}${match}`);
}
