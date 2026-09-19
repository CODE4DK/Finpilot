import {
  CSV_BOM,
  CSV_COLUMNS,
  buildCsv,
  csvFileName,
  escapeCsvField,
  paiseToCsvAmount,
  signedPaise,
  toLocalDateTimeFields,
} from '@/features/reports/csv';
import type { ExportRow } from '@/features/reports/queries';

function row(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    occurred_at: new Date(2026, 8, 2, 14, 5).toISOString(),
    type: 'expense',
    amount_paise: 123450,
    category_name: 'Food',
    account_name: 'HDFC',
    to_account_name: null,
    note: 'Lunch',
    ...overrides,
  };
}

describe('paiseToCsvAmount', () => {
  it('writes rupees with two decimals and no grouping', () => {
    // Grouping is for humans; a comma inside a CSV number is a new column.
    expect(paiseToCsvAmount(10000000)).toBe('100000.00');
    expect(paiseToCsvAmount(123450)).toBe('1234.50');
    expect(paiseToCsvAmount(5)).toBe('0.05');
    expect(paiseToCsvAmount(0)).toBe('0.00');
  });

  it('keeps the sign on the rupees, not the paise', () => {
    expect(paiseToCsvAmount(-123450)).toBe('-1234.50');
  });
});

describe('signedPaise', () => {
  it('leaves money going out negative', () => {
    expect(signedPaise('income', 5000)).toBe(5000);
    expect(signedPaise('expense', 5000)).toBe(-5000);
    expect(signedPaise('transfer', 5000)).toBe(-5000);
  });
});

describe('escapeCsvField', () => {
  it('quotes a field containing a comma, quote or newline', () => {
    expect(escapeCsvField('Chai, samosa')).toBe('"Chai, samosa"');
    expect(escapeCsvField('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeCsvField('two\nlines')).toBe('"two\nlines"');
  });

  it('leaves a plain field alone', () => {
    expect(escapeCsvField('Groceries')).toBe('Groceries');
    expect(escapeCsvField(null)).toBe('');
  });

  it('defuses a note a spreadsheet would execute', () => {
    // A note is free text; this is the one that matters.
    expect(escapeCsvField('=1+1')).toBe("'=1+1");
    expect(escapeCsvField('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)");
    expect(escapeCsvField('-2+3')).toBe("'-2+3");
    expect(escapeCsvField('=cmd|"/c calc"!A1')).toBe('"\'=cmd|""/c calc""!A1"');
  });
});

describe('toLocalDateTimeFields', () => {
  it('splits into the local date and time the money was spent', () => {
    const fields = toLocalDateTimeFields(new Date(2026, 8, 2, 9, 5).toISOString());

    expect(fields).toEqual({ date: '2026-09-02', time: '09:05' });
  });
});

describe('buildCsv', () => {
  it('starts with a BOM and the header row', () => {
    const csv = buildCsv([]);

    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.slice(1).trim()).toBe(CSV_COLUMNS.join(','));
  });

  it('uses CRLF, which is what Excel expects', () => {
    const csv = buildCsv([row()]);

    expect(csv).toContain('\r\n');
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(2);
  });

  it('writes a readable row with both amount columns', () => {
    const [, line] = buildCsv([row()]).split('\r\n');

    expect(line).toBe('2026-09-02,14:05,Expense,1234.50,-1234.50,Food,HDFC,,Lunch');
  });

  it('carries the destination account of a transfer', () => {
    const [, line] = buildCsv([
      row({ type: 'transfer', category_name: null, to_account_name: 'Cash' }),
    ]).split('\r\n');

    expect(line).toContain('Transfer');
    expect(line).toContain('HDFC,Cash,');
  });

  it('escapes a note that would otherwise break the columns', () => {
    const [, line] = buildCsv([row({ note: 'Chai, samosa' })]).split('\r\n');

    expect(line!.endsWith('"Chai, samosa"')).toBe(true);
  });
});

describe('csvFileName', () => {
  it('names the file after the days it actually covers', () => {
    // `to` is exclusive, so a September file must not say 1 October.
    expect(
      csvFileName({
        from: new Date(2026, 8, 1).toISOString(),
        to: new Date(2026, 9, 1).toISOString(),
      }),
    ).toBe('finpilot-2026-09-01-to-2026-09-30.csv');
  });
});
