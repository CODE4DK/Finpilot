/**
 * A stand-in for the PowerSync database used by the router tests.
 *
 * `getPowerSync()` constructs a real PowerSyncDatabase, which immediately
 * tries to load the op-sqlite extension and fails under Jest. Screens only
 * need something the PowerSyncContext can hold and `useQuery` can read from,
 * so this provides exactly that.
 */
export function createFakePowerSync() {
  return {
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
    getAll: jest.fn(async () => []),
    getOptional: jest.fn(async () => null),
    execute: jest.fn(async () => ({ rowsAffected: 0 })),
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
