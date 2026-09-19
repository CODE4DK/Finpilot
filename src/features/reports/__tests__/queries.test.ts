import { DatabaseSync } from 'node:sqlite';

import {
  categoryChangeQuery,
  categorySpendQuery,
  exportRowsQuery,
  monthlyTotalsQuery,
  periodTotalsQuery,
  topExpensesQuery,
  type CategoryChangeRow,
  type CategorySpendRow,
  type ExportRow,
  type MonthlyTotalsRow,
  type PeriodTotalsRow,
  type TopExpenseRow,
} from '@/features/reports/queries';
import { monthBuckets, precedingPeriod, resolveReportPeriod } from '@/features/reports/periods';

/**
 * These run against a real SQLite, because the whole point of the report layer
 * is that SQLite does the arithmetic on the device. Asserting on the SQL
 * string would only prove we can write a string.
 */

const USER = 'a1111111-1111-4111-8111-111111111111';
const OTHER_USER = 'b2222222-2222-4222-8222-222222222222';
const NOW = new Date(2026, 8, 19, 12, 0);

const FOOD = 'cat-food';
const TRAVEL = 'cat-travel';
const RENT = 'cat-rent';

function iso(year: number, monthIndex: number, day: number, hour = 12): string {
  return new Date(year, monthIndex, day, hour).toISOString();
}

function seed(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY, user_id TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT,
      type TEXT, amount_paise INTEGER, account_id TEXT, to_account_id TEXT,
      category_id TEXT, note TEXT, occurred_at TEXT, recurring_rule_id TEXT
    );
    CREATE TABLE categories (id TEXT, user_id TEXT, name TEXT);
    CREATE TABLE accounts (id TEXT, user_id TEXT, name TEXT);
  `);

  const insert = db.prepare(`
    INSERT INTO transactions
      (id, user_id, created_at, updated_at, deleted_at, type, amount_paise, account_id, to_account_id, category_id, note, occurred_at, recurring_rule_id)
    VALUES (?, ?, '2026-01-01', '2026-01-01', ?, ?, ?, 'acc-1', ?, ?, ?, ?, NULL)
  `);

  const add = (
    id: string,
    type: string,
    amountPaise: number,
    categoryId: string | null,
    occurredAt: string,
    options: { userId?: string; deletedAt?: string; note?: string; toAccountId?: string } = {},
  ) =>
    insert.run(
      id,
      options.userId ?? USER,
      options.deletedAt ?? null,
      type,
      amountPaise,
      options.toAccountId ?? null,
      categoryId,
      options.note ?? null,
      occurredAt,
    );

  // September: the period under test.
  add('t1', 'expense', 120000, FOOD, iso(2026, 8, 2));
  add('t2', 'expense', 80000, FOOD, iso(2026, 8, 11));
  add('t3', 'expense', 500000, RENT, iso(2026, 8, 1));
  add('t4', 'expense', 30000, null, iso(2026, 8, 15)); // uncategorised
  add('t5', 'income', 9000000, null, iso(2026, 8, 1));
  // Neither income nor expense - it must not reach any total.
  add('t6', 'transfer', 2500000, null, iso(2026, 8, 5), { toAccountId: 'acc-2' });
  // Soft-deleted: still in the table, never in a report.
  add('t7', 'expense', 999999, FOOD, iso(2026, 8, 6), { deletedAt: '2026-09-07' });
  // Another user's row, in the same window.
  add('t8', 'expense', 777777, FOOD, iso(2026, 8, 6), { userId: OTHER_USER });

  // August: the comparison period.
  add('t9', 'expense', 150000, FOOD, iso(2026, 7, 4));
  add('t10', 'expense', 60000, TRAVEL, iso(2026, 7, 20));
  add('t11', 'income', 9000000, null, iso(2026, 7, 1));

  // July, so a three-month window has something in every bucket.
  add('t12', 'expense', 40000, FOOD, iso(2026, 6, 9));

  return db;
}

const all = <T>(db: DatabaseSync, query: { sql: string; parameters: unknown[] }): T[] =>
  db.prepare(query.sql).all(...(query.parameters as never[])) as T[];

describe('report queries', () => {
  let db: DatabaseSync;
  const period = resolveReportPeriod('this-month', NOW);

  beforeEach(() => {
    db = seed();
  });

  afterEach(() => {
    db.close();
  });

  describe('periodTotalsQuery', () => {
    it('sums income and expense for the period', () => {
      const [row] = all<PeriodTotalsRow>(db, periodTotalsQuery(USER, period));

      // 1200 + 800 + 5000 + 300 rupees; the transfer and the deleted row are out.
      expect(row!.expense_paise).toBe(730000);
      expect(row!.income_paise).toBe(9000000);
      expect(row!.expense_count).toBe(4);
    });

    it('never counts another user, even in the same window', () => {
      const [row] = all<PeriodTotalsRow>(db, periodTotalsQuery(OTHER_USER, period));

      expect(row!.expense_paise).toBe(777777);
    });

    it('returns zeros rather than nothing for an empty period', () => {
      const empty = resolveReportPeriod('custom', NOW, {
        start: new Date(2020, 0, 1),
        end: new Date(2020, 0, 31),
      });
      const [row] = all<PeriodTotalsRow>(db, periodTotalsQuery(USER, empty));

      expect(row).toEqual({ income_paise: 0, expense_paise: 0, expense_count: 0 });
    });
  });

  describe('categorySpendQuery', () => {
    it('groups expenses by category, biggest first', () => {
      const rows = all<CategorySpendRow>(db, categorySpendQuery(USER, period));

      expect(rows).toEqual([
        { category_id: RENT, spent_paise: 500000, txn_count: 1 },
        { category_id: FOOD, spent_paise: 200000, txn_count: 2 },
        { category_id: null, spent_paise: 30000, txn_count: 1 },
      ]);
    });

    it('leaves income and transfers out entirely', () => {
      const rows = all<CategorySpendRow>(db, categorySpendQuery(USER, period));

      expect(rows.reduce((total, row) => total + row.spent_paise, 0)).toBe(730000);
    });
  });

  describe('monthlyTotalsQuery', () => {
    it('returns one row per local month, oldest first', () => {
      const threeMonths = resolveReportPeriod('last-3-months', NOW);
      const rows = all<MonthlyTotalsRow>(db, monthlyTotalsQuery(USER, monthBuckets(threeMonths)));

      expect(rows.map((row) => row.month_key)).toEqual(['2026-07', '2026-08', '2026-09']);
      expect(rows[0]!.expense_paise).toBe(40000);
      expect(rows[1]!.expense_paise).toBe(210000);
      expect(rows[2]!.expense_paise).toBe(730000);
      expect(rows[2]!.income_paise).toBe(9000000);
    });

    it('still returns a zero row for a month with nothing in it', () => {
      const window = resolveReportPeriod('custom', NOW, {
        start: new Date(2026, 3, 1),
        end: new Date(2026, 4, 30),
      });
      const rows = all<MonthlyTotalsRow>(db, monthlyTotalsQuery(USER, monthBuckets(window)));

      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.income_paise === 0 && row.expense_paise === 0)).toBe(true);
    });

    it('is an empty result rather than invalid SQL with no buckets', () => {
      expect(all(db, monthlyTotalsQuery(USER, []))).toEqual([]);
    });
  });

  describe('categoryChangeQuery', () => {
    it('puts both periods on one row per category', () => {
      const rows = all<CategoryChangeRow>(
        db,
        categoryChangeQuery(USER, period, precedingPeriod(period)),
      );
      const byId = new Map(rows.map((row) => [row.category_id, row]));

      expect(byId.get(FOOD)).toEqual({
        category_id: FOOD,
        current_paise: 200000,
        previous_paise: 150000,
      });
      // Rent is new this month...
      expect(byId.get(RENT)!.previous_paise).toBe(0);
      // ...and travel stopped, which is just as interesting.
      expect(byId.get(TRAVEL)).toEqual({
        category_id: TRAVEL,
        current_paise: 0,
        previous_paise: 60000,
      });
    });

    it('does not reach outside the two periods', () => {
      const rows = all<CategoryChangeRow>(
        db,
        categoryChangeQuery(USER, period, precedingPeriod(period)),
      );
      const food = rows.find((row) => row.category_id === FOOD)!;

      // July's 400 rupees of food is in neither window.
      expect(food.current_paise + food.previous_paise).toBe(350000);
    });
  });

  describe('topExpensesQuery', () => {
    it('returns the largest expenses, capped', () => {
      const rows = all<TopExpenseRow>(db, topExpensesQuery(USER, period, 3));

      expect(rows.map((row) => row.id)).toEqual(['t3', 't1', 't2']);
      expect(rows[0]!.amount_paise).toBe(500000);
    });
  });

  describe('exportRowsQuery', () => {
    beforeEach(() => {
      db.exec(`
        INSERT INTO categories (id, user_id, name) VALUES ('${FOOD}', '${USER}', 'Food');
        INSERT INTO accounts (id, user_id, name) VALUES ('acc-1', '${USER}', 'HDFC');
        INSERT INTO accounts (id, user_id, name) VALUES ('acc-2', '${USER}', 'Cash');
      `);
    });

    it('resolves names and keeps transfers, oldest first', () => {
      const rows = all<ExportRow>(db, exportRowsQuery(USER, period));

      expect(rows.map((row) => row.type)).toEqual([
        'expense',
        'income',
        'expense',
        'transfer',
        'expense',
        'expense',
      ]);
      const food = rows.find((row) => row.category_name === 'Food')!;
      expect(food.account_name).toBe('HDFC');
      const transfer = rows.find((row) => row.type === 'transfer')!;
      expect(transfer.to_account_name).toBe('Cash');
    });

    it('excludes soft-deleted rows and other users', () => {
      const rows = all<ExportRow>(db, exportRowsQuery(USER, period));

      expect(rows).toHaveLength(6);
      expect(rows.some((row) => row.amount_paise === 999999)).toBe(false);
      expect(rows.some((row) => row.amount_paise === 777777)).toBe(false);
    });
  });
});
