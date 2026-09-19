/**
 * The slice of the PowerSync database the repositories actually use.
 *
 * Depending on this rather than `AbstractPowerSyncDatabase` is what lets the
 * repository tests run against a plain mock: op-sqlite is a native module and
 * cannot open a database under Jest.
 */
export interface PowerSyncDatabaseLike {
  getAll<T>(sql: string, parameters?: unknown[]): Promise<T[]>;
  getOptional<T>(sql: string, parameters?: unknown[]): Promise<T | null>;
  execute(sql: string, parameters?: unknown[]): Promise<unknown>;
}

/** Columns every synced row carries. */
export interface SyncedRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RepositoryContext {
  db: PowerSyncDatabaseLike;
  userId: string;
  /** Injectable clock, so tests are not at the mercy of the wall clock. */
  now?: () => Date;
}
