import { PowerSyncDatabase, type AbstractPowerSyncDatabase } from '@powersync/react-native';

import { SupabaseConnector } from './connector';
import { AppSchema } from './schema';

/**
 * The local database. Created lazily so that importing this module never
 * opens a SQLite file - tests and the sign-out path both rely on that.
 */

export const DATABASE_FILENAME = 'finpilot.sqlite';

let database: AbstractPowerSyncDatabase | null = null;
let connector: SupabaseConnector | null = null;

export function getPowerSync(): AbstractPowerSyncDatabase {
  database ??= new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename: DATABASE_FILENAME },
  });
  return database;
}

/**
 * Starts syncing. Safe to call more than once - PowerSync ignores a connect on
 * an already-connected database, which matters because the auth listener can
 * fire again on a token refresh.
 */
export async function connectPowerSync(): Promise<void> {
  const db = getPowerSync();
  connector ??= new SupabaseConnector();
  await db.connect(connector);
}

export async function disconnectPowerSync(): Promise<void> {
  if (!database) {
    return;
  }
  await database.disconnect();
}

/**
 * Sign-out: stop syncing and wipe the local database, so the next user on this
 * device inherits nothing. Clearing is not optional - the rows are another
 * person's finances.
 */
export async function disconnectAndClearPowerSync(): Promise<void> {
  if (!database) {
    return;
  }
  await database.disconnectAndClear();
}

/**
 * Drops the memoised instance so the next sign-in opens a fresh database with
 * a connector bound to the new session. Also the seam the tests use.
 */
export function resetPowerSyncInstance(): void {
  database = null;
  connector = null;
}
