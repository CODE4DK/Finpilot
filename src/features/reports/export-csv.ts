/**
 * Writing the CSV out and handing it to the share sheet.
 *
 * The file goes to the cache directory, not documents: it is a copy of data
 * the database already holds, so it is disposable, and the OS may reclaim it.
 * Everything that can be tested without a device lives in `csv.ts`; this
 * module is the thin native edge.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { PowerSyncDatabaseLike } from '@/db/repositories/types';
import type { Period } from '@/features/ledger/period';

import { buildCsv, csvFileName } from './csv';
import { exportRowsQuery, type ExportRow } from './queries';

export type CsvExportResult =
  | { status: 'shared'; uri: string; rowCount: number }
  | { status: 'empty' }
  | { status: 'unavailable'; uri: string; rowCount: number };

export async function fetchExportRows(
  db: PowerSyncDatabaseLike,
  userId: string,
  period: Period,
): Promise<ExportRow[]> {
  const { sql, parameters } = exportRowsQuery(userId, period);
  return db.getAll<ExportRow>(sql, parameters);
}

export async function exportPeriodCsv(
  db: PowerSyncDatabaseLike,
  userId: string,
  period: Period,
): Promise<CsvExportResult> {
  const rows = await fetchExportRows(db, userId, period);
  if (rows.length === 0) {
    return { status: 'empty' };
  }

  const file = new File(Paths.cache, csvFileName(period));
  // A second export of the same period should replace the first, not fail.
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(buildCsv(rows));

  if (!(await Sharing.isAvailableAsync())) {
    // Rare (a locked-down device, or a simulator without a share sheet). The
    // file is still written, so the caller can tell the user where it is.
    return { status: 'unavailable', uri: file.uri, rowCount: rows.length };
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export transactions',
    UTI: 'public.comma-separated-values-text',
  });

  return { status: 'shared', uri: file.uri, rowCount: rows.length };
}
