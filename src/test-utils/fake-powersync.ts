/**
 * A stand-in for the PowerSync database used by the router tests.
 *
 * `getPowerSync()` constructs a real PowerSyncDatabase, which immediately
 * tries to load the op-sqlite extension and fails under Jest. Screens need
 * something the PowerSyncContext can hold and that `useQuery` can subscribe
 * to, so this implements the small slice of the watched-query contract the
 * hooks actually touch: `customQuery(...).watch()` returning an object with a
 * `state` and a `registerListener`.
 *
 * Rows can be seeded per query with `setRows`, which is matched on a substring
 * of the SQL - enough for a screen test to say "transactions come back empty"
 * or "these two accounts exist".
 */

export interface FakeQueryState<T = unknown> {
  data: T[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | undefined;
}

function emptyState<T>(data: T[] = []): FakeQueryState<T> {
  return { data, isLoading: false, isFetching: false, error: undefined };
}

export function createFakePowerSync() {
  /** SQL fragment -> rows to return for any query containing it. */
  const seeded = new Map<string, unknown[]>();

  function rowsFor(sql: string): unknown[] {
    for (const [fragment, rows] of seeded) {
      if (sql.includes(fragment)) {
        return rows;
      }
    }
    return [];
  }

  /**
   * The hook calls `customQuery` once and then re-points the same watcher with
   * `updateSettings` whenever the SQL changes - which is exactly what happens
   * when the user id arrives and a repository query replaces the placeholder.
   * The fake therefore has to re-read its rows on updateSettings and tell its
   * listeners, or the screen would be stuck on the first result forever.
   */
  function makeWatchedQuery(initialSql: string) {
    const listeners = new Set<{ onStateChange?: (state: FakeQueryState) => void }>();

    const watched = {
      state: emptyState(rowsFor(initialSql)),
      registerListener(listener: { onStateChange?: (state: FakeQueryState) => void }) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      updateSettings(settings: { query?: { compile?: () => { sql: string } } }) {
        const sql = settings?.query?.compile?.().sql ?? initialSql;
        watched.state = emptyState(rowsFor(sql));
        listeners.forEach((listener) => listener.onStateChange?.(watched.state));
      },
      close() {
        listeners.clear();
      },
    };

    return watched;
  }

  return {
    /** Seed rows for every query whose SQL contains `fragment`. */
    setRows(fragment: string, rows: unknown[]) {
      seeded.set(fragment, rows);
    },
    clearRows() {
      seeded.clear();
    },

    customQuery(query: { sql?: string; compile?: () => { sql: string } }) {
      const sql = query?.sql ?? query?.compile?.().sql ?? '';
      return {
        watch: () => makeWatchedQuery(sql),
        differentialWatch: () => makeWatchedQuery(sql),
      };
    },

    currentStatus: {
      connected: false,
      connecting: false,
      hasSynced: false,
      dataFlowStatus: {},
      lastSyncedAt: null,
    },
    registerListener: jest.fn(() => () => {}),
    onChange: jest.fn(() => () => {}),
    onChangeWithCallback: jest.fn(() => () => {}),
    watch: jest.fn(),
    getAll: jest.fn(async (_sql: string, _parameters?: unknown[]) => [] as unknown[]),
    getOptional: jest.fn(async (_sql: string, _parameters?: unknown[]) => null as unknown),
    execute: jest.fn(async (_sql: string, _parameters?: unknown[]) => ({ rowsAffected: 0 })),
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    disconnectAndClear: jest.fn(async () => {}),
    resolveTables: jest.fn(async () => []),
    waitForReady: jest.fn(async () => {}),
    init: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
}

export type FakePowerSync = ReturnType<typeof createFakePowerSync>;
