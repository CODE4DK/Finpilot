import type { RecurrenceFrequency, TransactionType } from '@/db/enums';

import { BaseRepository } from './base';
import type { RepositoryContext, SyncedRow } from './types';

export interface RecurringRuleRow extends SyncedRow {
  type: string;
  amount_paise: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note: string | null;
  frequency: string;
  interval: number;
  next_run_at: string;
  end_at: string | null;
  is_active: number;
}

export interface RecurringRuleInsert extends Record<string, unknown> {
  type: TransactionType;
  amount_paise: number;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  note?: string | null;
  frequency: RecurrenceFrequency;
  interval?: number;
  next_run_at: string;
  end_at?: string | null;
  is_active?: number;
}

export class RecurringRulesRepository extends BaseRepository<
  RecurringRuleRow,
  RecurringRuleInsert
> {
  constructor(context: RepositoryContext) {
    super('recurring_rules', context);
  }

  listQuery(): { sql: string; parameters: unknown[] } {
    return {
      sql: `SELECT * FROM recurring_rules ${this.liveWhere()} ORDER BY is_active DESC, next_run_at ASC`,
      parameters: [this.userId],
    };
  }

  override async list(): Promise<RecurringRuleRow[]> {
    const { sql, parameters } = this.listQuery();
    return this.db.getAll<RecurringRuleRow>(sql, parameters);
  }

  /** Rules whose next run has come around - the generator's work list. */
  async listDue(asOf: string): Promise<RecurringRuleRow[]> {
    return this.db.getAll<RecurringRuleRow>(
      `SELECT * FROM recurring_rules ${this.liveWhere('is_active = 1 AND next_run_at <= ? AND (end_at IS NULL OR end_at >= ?)')} ORDER BY next_run_at ASC`,
      [this.userId, asOf, asOf],
    );
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.update(id, { is_active: active ? 1 : 0 });
  }
}
