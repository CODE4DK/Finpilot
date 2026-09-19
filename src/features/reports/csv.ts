/**
 * CSV generation for the export.
 *
 * Aimed at a spreadsheet, so:
 *   * amounts are rupees with two decimals and no symbol or grouping - "1234.50",
 *     which Excel and Google Sheets both read as a number;
 *   * the file is CRLF-terminated and carries a UTF-8 byte-order mark, or Excel
 *     on Windows renders ₹ and Devanagari notes as mojibake;
 *   * a field that could be read as a formula is prefixed with an apostrophe.
 *     A note reading `=cmd|...` is a real attack on whoever opens the file, and
 *     notes are free text.
 */

import { PAISE_PER_RUPEE } from '@/utils/money';

import type { ExportRow } from './queries';

export const CSV_BOM = '﻿';
const CRLF = '\r\n';

export const CSV_COLUMNS = [
  'Date',
  'Time',
  'Type',
  'Amount (INR)',
  'Signed amount (INR)',
  'Category',
  'Account',
  'To account',
  'Note',
] as const;

/** Paise to a plain decimal string: 123450 -> "1234.50". */
export function paiseToCsvAmount(paise: number): string {
  const negative = paise < 0;
  const absolute = Math.abs(paise);
  const rupees = Math.trunc(absolute / PAISE_PER_RUPEE);
  const remainder = absolute % PAISE_PER_RUPEE;
  return `${negative ? '-' : ''}${rupees}.${String(remainder).padStart(2, '0')}`;
}

/** Expense and transfer leave the account, so they export as negative. */
export function signedPaise(type: string, amountPaise: number): number {
  return type === 'income' ? amountPaise : -amountPaise;
}

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export function escapeCsvField(value: string | null | undefined): string {
  const raw = value ?? '';
  // Neutralise a field a spreadsheet would evaluate. The leading apostrophe is
  // the convention both Excel and Sheets understand as "this is text".
  const safe = FORMULA_PREFIXES.some((prefix) => raw.startsWith(prefix)) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Local date and time, because that is the day the user spent the money. */
export function toLocalDateTimeFields(iso: string): { date: string; time: string } {
  const at = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
}

const TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
};

export function buildCsv(rows: readonly ExportRow[]): string {
  const lines = [CSV_COLUMNS.join(',')];

  for (const row of rows) {
    const { date, time } = toLocalDateTimeFields(row.occurred_at);
    lines.push(
      [
        date,
        time,
        TYPE_LABELS[row.type] ?? row.type,
        paiseToCsvAmount(row.amount_paise),
        paiseToCsvAmount(signedPaise(row.type, row.amount_paise)),
        escapeCsvField(row.category_name),
        escapeCsvField(row.account_name),
        escapeCsvField(row.to_account_name),
        escapeCsvField(row.note),
      ].join(','),
    );
  }

  return CSV_BOM + lines.join(CRLF) + CRLF;
}

/** "finpilot-2026-09-01-to-2026-09-30.csv" - sorts and reads sensibly. */
export function csvFileName(period: { from: string; to: string }): string {
  const start = toLocalDateTimeFields(period.from).date;
  // `to` is exclusive, so name the file after the last day it covers.
  const lastDay = new Date(new Date(period.to).getTime() - 1).toISOString();
  return `finpilot-${start}-to-${toLocalDateTimeFields(lastDay).date}.csv`;
}
