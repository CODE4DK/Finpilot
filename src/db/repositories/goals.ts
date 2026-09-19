import type { GoalStatus } from '@/db/enums';

import { BaseRepository } from './base';
import type { RepositoryContext, SyncedRow } from './types';

export interface GoalRow extends SyncedRow {
  name: string;
  target_paise: number;
  target_date: string | null;
  icon: string | null;
  status: string;
}

export interface GoalInsert extends Record<string, unknown> {
  name: string;
  target_paise: number;
  target_date?: string | null;
  icon?: string | null;
  status?: GoalStatus;
}

export interface GoalContributionRow extends SyncedRow {
  goal_id: string;
  amount_paise: number;
  contributed_at: string;
  account_id: string | null;
}

export interface GoalContributionInsert extends Record<string, unknown> {
  goal_id: string;
  amount_paise: number;
  contributed_at?: string;
  account_id?: string | null;
}

export class GoalsRepository extends BaseRepository<GoalRow, GoalInsert> {
  constructor(context: RepositoryContext) {
    super('goals', context);
  }

  /** Goals with what has been contributed so far. */
  listQuery(status?: GoalStatus): { sql: string; parameters: unknown[] } {
    const parameters: unknown[] = [this.userId];
    let statusClause = '';
    if (status) {
      statusClause = ' AND g.status = ?';
      parameters.push(status);
    }

    return {
      sql: `
        SELECT
          g.*,
          COALESCE((
            SELECT SUM(c.amount_paise)
            FROM goal_contributions c
            WHERE c.goal_id = g.id AND c.user_id = g.user_id AND c.deleted_at IS NULL
          ), 0) AS saved_paise
        FROM goals g
        WHERE g.user_id = ? AND g.deleted_at IS NULL${statusClause}
        ORDER BY
          CASE g.status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
          g.target_date IS NULL,
          g.target_date ASC
      `,
      parameters,
    };
  }

  override async list(): Promise<GoalRow[]> {
    const { sql, parameters } = this.listQuery();
    return this.db.getAll<GoalRow>(sql, parameters);
  }

  async listWithProgress(status?: GoalStatus): Promise<(GoalRow & { saved_paise: number })[]> {
    const { sql, parameters } = this.listQuery(status);
    return this.db.getAll(sql, parameters);
  }

  async setStatus(id: string, status: GoalStatus): Promise<void> {
    await this.update(id, { status });
  }
}

export class GoalContributionsRepository extends BaseRepository<
  GoalContributionRow,
  GoalContributionInsert
> {
  constructor(context: RepositoryContext) {
    super('goal_contributions', context);
  }

  listQuery(goalId: string): { sql: string; parameters: unknown[] } {
    return {
      sql: `SELECT * FROM goal_contributions ${this.liveWhere('goal_id = ?')} ORDER BY contributed_at DESC`,
      parameters: [this.userId, goalId],
    };
  }

  async listForGoal(goalId: string): Promise<GoalContributionRow[]> {
    const { sql, parameters } = this.listQuery(goalId);
    return this.db.getAll<GoalContributionRow>(sql, parameters);
  }

  override async insert(values: GoalContributionInsert & { id?: string }): Promise<string> {
    return super.insert({ contributed_at: new Date(this.now()).toISOString(), ...values });
  }
}
