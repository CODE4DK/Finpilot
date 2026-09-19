/**
 * "Export my data" - everything, not just a period of transactions.
 *
 * This is the data-portability half of what the stores ask for (deletion is
 * the other half). It reads the **local** database, so it works offline and
 * needs no server round trip: the local database is the source of truth.
 *
 * The file is JSON rather than CSV because this is an archive, not a
 * spreadsheet - it has to hold nine tables with their relationships intact.
 * The per-period CSV in Reports covers the spreadsheet case.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { PowerSyncDatabaseLike } from '@/db/repositories/types';

/** Every table a user's data lives in, in dependency order. */
export const EXPORTED_TABLES = [
  'profiles',
  'accounts',
  'categories',
  'recurring_rules',
  'transactions',
  'budgets',
  'goals',
  'goal_contributions',
  'insights',
] as const;

export type ExportedTable = (typeof EXPORTED_TABLES)[number];

export interface DataExport {
  format: 'finpilot.export.v1';
  exported_at: string;
  app_version: string;
  /** Amounts are integer paise, as they are everywhere in FinPilot. */
  amounts: 'integer_paise';
  tables: Record<string, unknown[]>;
  counts: Record<string, number>;
}

export interface BuildExportOptions {
  appVersion: string;
  now?: Date;
}

/**
 * Turns the rows into the archive. Pure, so the shape - and the promise that
 * every table is in it - is unit tested.
 */
export function buildExport(
  tables: Record<string, unknown[]>,
  { appVersion, now = new Date() }: BuildExportOptions,
): DataExport {
  const counts: Record<string, number> = {};
  for (const table of EXPORTED_TABLES) {
    counts[table] = tables[table]?.length ?? 0;
  }

  return {
    format: 'finpilot.export.v1',
    exported_at: now.toISOString(),
    app_version: appVersion,
    amounts: 'integer_paise',
    tables: Object.fromEntries(EXPORTED_TABLES.map((table) => [table, tables[table] ?? []])),
    counts,
  };
}

export function exportFileName(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `finpilot-export-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** Reads every table for this user, soft-deleted rows included. */
export async function readAllTables(
  db: PowerSyncDatabaseLike,
  userId: string,
): Promise<Record<string, unknown[]>> {
  const tables: Record<string, unknown[]> = {};

  for (const table of EXPORTED_TABLES) {
    // A deleted row is still the user's data, and an archive that silently
    // drops it is not a complete export.
    tables[table] = await db.getAll(`SELECT * FROM ${table} WHERE user_id = ?`, [userId]);
  }

  return tables;
}

export type ExportResult =
  | { status: 'shared'; uri: string; rowCount: number }
  | { status: 'unavailable'; uri: string; rowCount: number };

export async function exportAllData(
  db: PowerSyncDatabaseLike,
  userId: string,
  options: BuildExportOptions,
): Promise<ExportResult> {
  const tables = await readAllTables(db, userId);
  const archive = buildExport(tables, options);
  const rowCount = Object.values(archive.counts).reduce((total, count) => total + count, 0);

  const file = new File(Paths.cache, exportFileName(options.now));
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(JSON.stringify(archive, null, 2));

  if (!(await Sharing.isAvailableAsync())) {
    return { status: 'unavailable', uri: file.uri, rowCount };
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export FinPilot data',
    UTI: 'public.json',
  });

  return { status: 'shared', uri: file.uri, rowCount };
}
