import { BaseRepository } from './base';
import type { RepositoryContext, SyncedRow } from './types';

export interface InsightRow extends SyncedRow {
  month: string;
  /** jsonb, which arrives as TEXT - parse with `toJson`. */
  summary: string;
  generated_at: string;
}

export interface InsightInsert extends Record<string, unknown> {
  month: string;
  summary: string;
  generated_at?: string;
}

export class InsightsRepository extends BaseRepository<InsightRow, InsightInsert> {
  constructor(context: RepositoryContext) {
    super('insights', context);
  }

  listQuery(): { sql: string; parameters: unknown[] } {
    return {
      sql: `SELECT * FROM insights ${this.liveWhere()} ORDER BY month DESC`,
      parameters: [this.userId],
    };
  }

  override async list(): Promise<InsightRow[]> {
    const { sql, parameters } = this.listQuery();
    return this.db.getAll<InsightRow>(sql, parameters);
  }

  async findForMonth(month: string): Promise<InsightRow | null> {
    return this.db.getOptional<InsightRow>(
      `SELECT * FROM insights ${this.liveWhere('month = ?')}`,
      [this.userId, month],
    );
  }
}
