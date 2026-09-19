import type { CategoryType } from '@/db/enums';

import { BaseRepository } from './base';
import type { RepositoryContext, SyncedRow } from './types';

export interface CategoryRow extends SyncedRow {
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  is_default: number;
  parent_id: string | null;
}

export interface CategoryInsert extends Record<string, unknown> {
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
  is_default?: number;
  parent_id?: string | null;
}

export class CategoriesRepository extends BaseRepository<CategoryRow, CategoryInsert> {
  constructor(context: RepositoryContext) {
    super('categories', context);
  }

  listQuery(type?: CategoryType): { sql: string; parameters: unknown[] } {
    const where = type ? this.liveWhere('type = ?') : this.liveWhere();
    return {
      sql: `SELECT * FROM categories ${where} ORDER BY name COLLATE NOCASE ASC`,
      parameters: type ? [this.userId, type] : [this.userId],
    };
  }

  override async list(): Promise<CategoryRow[]> {
    const { sql, parameters } = this.listQuery();
    return this.db.getAll<CategoryRow>(sql, parameters);
  }

  async listByType(type: CategoryType): Promise<CategoryRow[]> {
    const { sql, parameters } = this.listQuery(type);
    return this.db.getAll<CategoryRow>(sql, parameters);
  }

  async listChildren(parentId: string): Promise<CategoryRow[]> {
    return this.db.getAll<CategoryRow>(
      `SELECT * FROM categories ${this.liveWhere('parent_id = ?')} ORDER BY name COLLATE NOCASE ASC`,
      [this.userId, parentId],
    );
  }
}
