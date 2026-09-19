import type { PowerSyncDatabaseLike } from '@/db/repositories/types';

export interface RecordedCall {
  sql: string;
  parameters: unknown[];
}

export interface MockDatabase extends PowerSyncDatabaseLike {
  /** Every call, in order, with whitespace collapsed for readable assertions. */
  calls: RecordedCall[];
  /** Only the calls that wrote. */
  writes: RecordedCall[];
  /** Queue a result for the next getAll. */
  queueRows: (rows: unknown[]) => void;
  /** Queue a result for the next getOptional. */
  queueRow: (row: unknown) => void;
  lastCall: () => RecordedCall | undefined;
  reset: () => void;
}

const WRITE_PREFIXES = ['INSERT', 'UPDATE', 'DELETE'];

/** Collapses whitespace so a multi-line query can be asserted on readably. */
export function normaliseSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

/**
 * A stand-in for the PowerSync database. op-sqlite is a native module and
 * cannot open a database under Jest, so repositories are tested against this:
 * it records the SQL and parameters they produce and replays queued rows.
 */
export function createMockDatabase(): MockDatabase {
  const calls: RecordedCall[] = [];
  const rowQueue: unknown[][] = [];
  const optionalQueue: unknown[] = [];

  const record = (sql: string, parameters: unknown[] = []) => {
    calls.push({ sql: normaliseSql(sql), parameters });
  };

  return {
    calls,
    get writes() {
      return calls.filter((call) =>
        WRITE_PREFIXES.some((prefix) => call.sql.toUpperCase().startsWith(prefix)),
      );
    },

    async getAll<T>(sql: string, parameters: unknown[] = []): Promise<T[]> {
      record(sql, parameters);
      return (rowQueue.shift() ?? []) as T[];
    },

    async getOptional<T>(sql: string, parameters: unknown[] = []): Promise<T | null> {
      record(sql, parameters);
      return (optionalQueue.length > 0 ? optionalQueue.shift() : null) as T | null;
    },

    async execute(sql: string, parameters: unknown[] = []): Promise<unknown> {
      record(sql, parameters);
      return { rowsAffected: 1 };
    },

    queueRows(rows: unknown[]) {
      rowQueue.push(rows);
    },

    queueRow(row: unknown) {
      optionalQueue.push(row);
    },

    lastCall() {
      return calls.at(-1);
    },

    reset() {
      calls.length = 0;
      rowQueue.length = 0;
      optionalQueue.length = 0;
    },
  };
}
