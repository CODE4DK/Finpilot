import type { AccountType } from '@/db/enums';

import { BaseRepository } from './base';
import type { RepositoryContext, SyncedRow } from './types';

export interface AccountRow extends SyncedRow {
  type: string;
  name: string;
  opening_balance_paise: number;
  color: string | null;
  icon: string | null;
  is_archived: number;
}

export interface AccountInsert extends Record<string, unknown> {
  name: string;
  type: AccountType;
  opening_balance_paise?: number;
  color?: string | null;
  icon?: string | null;
  is_archived?: number;
}

export class AccountsRepository extends BaseRepository<AccountRow, AccountInsert> {
  constructor(context: RepositoryContext) {
    super('accounts', context);
  }

  /** Active accounts, archived ones last, alphabetical within each group. */
  listQuery(): { sql: string; parameters: unknown[] } {
    return {
      sql: `SELECT * FROM accounts ${this.liveWhere()} ORDER BY is_archived ASC, name COLLATE NOCASE ASC`,
      parameters: [this.userId],
    };
  }

  override async list(): Promise<AccountRow[]> {
    const { sql, parameters } = this.listQuery();
    return this.db.getAll<AccountRow>(sql, parameters);
  }

  async listActive(): Promise<AccountRow[]> {
    return this.db.getAll<AccountRow>(
      `SELECT * FROM accounts ${this.liveWhere('is_archived = 0')} ORDER BY name COLLATE NOCASE ASC`,
      [this.userId],
    );
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    await this.update(id, { is_archived: archived ? 1 : 0 });
  }

  /**
   * Opening balance plus every posted movement. Transfers count twice: out of
   * the source account and into the destination.
   */
  balanceQuery(accountId: string): { sql: string; parameters: unknown[] } {
    return {
      sql: `
        SELECT
          a.opening_balance_paise
          + COALESCE((
              SELECT SUM(
                CASE t.type
                  WHEN 'income' THEN t.amount_paise
                  ELSE -t.amount_paise
                END
              )
              FROM transactions t
              WHERE t.account_id = a.id AND t.user_id = a.user_id AND t.deleted_at IS NULL
            ), 0)
          + COALESCE((
              SELECT SUM(t.amount_paise)
              FROM transactions t
              WHERE t.to_account_id = a.id AND t.user_id = a.user_id AND t.deleted_at IS NULL
            ), 0)
          AS balance_paise
        FROM accounts a
        WHERE a.id = ? AND a.user_id = ? AND a.deleted_at IS NULL
      `,
      parameters: [accountId, this.userId],
    };
  }

  async balance(accountId: string): Promise<number> {
    const { sql, parameters } = this.balanceQuery(accountId);
    const row = await this.db.getOptional<{ balance_paise: number }>(sql, parameters);
    return row?.balance_paise ?? 0;
  }
}
