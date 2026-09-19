import { BaseRepository } from './base';
import type { RepositoryContext, SyncedRow } from './types';

export interface ProfileRow extends SyncedRow {
  full_name: string | null;
  currency: string;
  timezone: string;
  onboarding_completed: number;
  ai_insights_opt_in: number;
}

export interface ProfileInsert extends Record<string, unknown> {
  full_name?: string | null;
  currency?: string;
  timezone?: string;
  onboarding_completed?: number;
  ai_insights_opt_in?: number;
}

/**
 * A profile is created server-side by the auth trigger, so this repository
 * reads and updates but never inserts.
 */
export class ProfilesRepository extends BaseRepository<ProfileRow, ProfileInsert> {
  constructor(context: RepositoryContext) {
    super('profiles', context);
  }

  currentQuery(): { sql: string; parameters: unknown[] } {
    return {
      sql: `SELECT * FROM profiles WHERE id = ? AND deleted_at IS NULL`,
      parameters: [this.userId],
    };
  }

  async current(): Promise<ProfileRow | null> {
    const { sql, parameters } = this.currentQuery();
    return this.db.getOptional<ProfileRow>(sql, parameters);
  }

  async setAiInsightsOptIn(optIn: boolean): Promise<void> {
    await this.update(this.userId, { ai_insights_opt_in: optIn ? 1 : 0 });
  }
}
