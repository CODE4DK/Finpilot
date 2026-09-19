import { createId } from '@/utils/id';

import { nowIso } from '../row-mappers';
import type { PowerSyncDatabaseLike, RepositoryContext } from './types';

/**
 * Shared write mechanics for every repository.
 *
 * Writes are local-first: they go into the local SQLite database and return
 * immediately, and PowerSync uploads them when it can. That is why the client
 * supplies the id and the timestamps - offline rows cannot wait for the
 * server, and `updated_at` is what conflict resolution compares (see
 * docs/SYNC.md).
 */

export function buildInsert(
  table: string,
  values: Record<string, unknown>,
): { sql: string; parameters: unknown[] } {
  const columns = Object.keys(values);
  const placeholders = columns.map(() => '?').join(', ');
  return {
    sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    parameters: columns.map((column) => values[column]),
  };
}

export function buildUpdate(
  table: string,
  id: string,
  userId: string,
  values: Record<string, unknown>,
): { sql: string; parameters: unknown[] } {
  const columns = Object.keys(values);
  if (columns.length === 0) {
    throw new Error(`No columns to update on ${table}`);
  }
  const assignments = columns.map((column) => `${column} = ?`).join(', ');
  return {
    // The user_id predicate is belt and braces: the bucket only ever contains
    // this user's rows, but a repository should not be able to write across
    // users even if that changed.
    sql: `UPDATE ${table} SET ${assignments} WHERE id = ? AND user_id = ?`,
    parameters: [...columns.map((column) => values[column]), id, userId],
  };
}

export abstract class BaseRepository<TRow, TInsert extends Record<string, unknown>> {
  protected readonly db: PowerSyncDatabaseLike;
  protected readonly userId: string;
  protected readonly now: () => Date;

  constructor(
    protected readonly table: string,
    context: RepositoryContext,
  ) {
    this.db = context.db;
    this.userId = context.userId;
    this.now = context.now ?? (() => new Date());
  }

  /** Live rows only, newest first unless a subclass says otherwise. */
  protected liveWhere(extra?: string): string {
    return `WHERE user_id = ? AND deleted_at IS NULL${extra ? ` AND ${extra}` : ''}`;
  }

  async list(): Promise<TRow[]> {
    return this.db.getAll<TRow>(
      `SELECT * FROM ${this.table} ${this.liveWhere()} ORDER BY created_at DESC`,
      [this.userId],
    );
  }

  async findById(id: string): Promise<TRow | null> {
    return this.db.getOptional<TRow>(
      `SELECT * FROM ${this.table} WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, this.userId],
    );
  }

  async count(): Promise<number> {
    const row = await this.db.getOptional<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${this.table} ${this.liveWhere()}`,
      [this.userId],
    );
    return row?.count ?? 0;
  }

  /**
   * Inserts locally and returns the new id. The id is generated here rather
   * than by the server so the row is usable offline immediately.
   */
  async insert(values: TInsert & { id?: string }): Promise<string> {
    const id = values.id ?? createId();
    const timestamp = nowIso(this.now());

    const { id: _ignored, ...rest } = values;
    const { sql, parameters } = buildInsert(this.table, {
      id,
      user_id: this.userId,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      ...rest,
    });

    await this.db.execute(sql, parameters);
    return id;
  }

  /** Stamps `updated_at` from the client clock - the tie-breaker for sync. */
  async update(id: string, values: Partial<TInsert>): Promise<void> {
    const { sql, parameters } = buildUpdate(this.table, id, this.userId, {
      ...values,
      updated_at: nowIso(this.now()),
    });
    await this.db.execute(sql, parameters);
  }

  /**
   * Deletes locally. The connector turns the queued DELETE into a server-side
   * `deleted_at` stamp, because the database has no DELETE policy for clients.
   */
  async remove(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM ${this.table} WHERE id = ? AND user_id = ?`, [
      id,
      this.userId,
    ]);
  }
}
