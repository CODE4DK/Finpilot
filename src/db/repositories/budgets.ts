import { BaseRepository } from './base';
import type { RepositoryContext, SyncedRow } from './types';

export interface BudgetRow extends SyncedRow {
  category_id: string;
  month: string;
  limit_paise: number;
  alert_80_sent: number;
  alert_100_sent: number;
}

export interface BudgetInsert extends Record<string, unknown> {
  category_id: string;
  month: string;
  limit_paise: number;
  alert_80_sent?: number;
  alert_100_sent?: number;
}

/** "2026-09-01" - budgets are keyed to the first day of their month. */
export function toMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}-01`;
}

export class BudgetsRepository extends BaseRepository<BudgetRow, BudgetInsert> {
  constructor(context: RepositoryContext) {
    super('budgets', context);
  }

  listQuery(month: string): { sql: string; parameters: unknown[] } {
    return {
      sql: `SELECT * FROM budgets ${this.liveWhere('month = ?')} ORDER BY created_at ASC`,
      parameters: [this.userId, month],
    };
  }

  async listForMonth(month: string): Promise<BudgetRow[]> {
    const { sql, parameters } = this.listQuery(month);
    return this.db.getAll<BudgetRow>(sql, parameters);
  }

  /**
   * Budgets joined to what has actually been spent in that month, so the
   * progress bars come from one query rather than N.
   */
  progressQuery(month: string): { sql: string; parameters: unknown[] } {
    return {
      sql: `
        SELECT
          b.*,
          COALESCE((
            SELECT SUM(t.amount_paise)
            FROM transactions t
            WHERE t.user_id = b.user_id
              AND t.category_id = b.category_id
              AND t.type = 'expense'
              AND t.deleted_at IS NULL
              AND t.occurred_at >= b.month
              AND t.occurred_at < date(b.month, '+1 month')
          ), 0) AS spent_paise
        FROM budgets b
        WHERE b.user_id = ? AND b.deleted_at IS NULL AND b.month = ?
        ORDER BY spent_paise DESC
      `,
      parameters: [this.userId, month],
    };
  }

  async progressForMonth(month: string): Promise<(BudgetRow & { spent_paise: number })[]> {
    const { sql, parameters } = this.progressQuery(month);
    return this.db.getAll(sql, parameters);
  }

  async findForCategory(categoryId: string, month: string): Promise<BudgetRow | null> {
    return this.db.getOptional<BudgetRow>(
      `SELECT * FROM budgets ${this.liveWhere('category_id = ? AND month = ?')}`,
      [this.userId, categoryId, month],
    );
  }
}
