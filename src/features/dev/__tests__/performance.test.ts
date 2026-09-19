/**
 * The 10,000-row budget.
 *
 * The seed screen loads a plausible three-year ledger into a development
 * build so performance can be judged by feel. This is the half that runs in
 * CI: the same data, through the same pure functions the screens use, with a
 * ceiling on how long each is allowed to take.
 *
 * The numbers are deliberately loose - a CI box is not a phone, and a tight
 * budget here would fail for reasons that have nothing to do with the code.
 * They are regression guards, not benchmarks: they catch the accidental
 * quadratic, not a 10% drift.
 */

import { groupByDay, toListItems } from '@/features/ledger/grouping';
import { accountBalances, periodTotals } from '@/features/ledger/balances';
import {
  DEFAULT_SEED_COUNT,
  buildSeedTransactions,
  createRandom,
  seededId,
  toBatches,
} from '@/features/dev/seed-data';
import { buildCategorySlices } from '@/features/reports';
import { PAGE_SIZE } from '@/features/transactions/use-transaction-list';

const ACCOUNTS = ['acc-1', 'acc-2', 'acc-3'];
const CATEGORIES = Array.from({ length: 17 }, (_, index) => `cat-${index}`);

const ROWS = buildSeedTransactions({
  accountIds: ACCOUNTS,
  categoryIds: CATEGORIES,
  count: DEFAULT_SEED_COUNT,
  now: new Date('2026-09-19T12:00:00.000Z'),
});

function timed(work: () => unknown): number {
  const started = performance.now();
  work();
  return performance.now() - started;
}

describe('the generator', () => {
  it('produces the asked-for number of rows', () => {
    expect(ROWS).toHaveLength(DEFAULT_SEED_COUNT);
  });

  it('is deterministic, so a measurement can be repeated', () => {
    // Same seed and same `now` in, identical ledger out - the timings below
    // are comparable between runs because of this.
    const options = {
      accountIds: ACCOUNTS,
      categoryIds: CATEGORIES,
      count: 50,
      now: new Date('2026-09-19T12:00:00.000Z'),
    };

    expect(buildSeedTransactions(options)).toEqual(buildSeedTransactions(options));
  });

  it('produces a different ledger for a different seed', () => {
    const now = new Date('2026-09-19T12:00:00.000Z');
    const a = buildSeedTransactions({
      accountIds: ACCOUNTS,
      categoryIds: CATEGORIES,
      count: 20,
      now,
    });
    const b = buildSeedTransactions({
      accountIds: ACCOUNTS,
      categoryIds: CATEGORIES,
      count: 20,
      now,
      seed: 7,
    });

    expect(a[0]!.id).not.toBe(b[0]!.id);
  });

  it('generates ids that are unique and v4-shaped', () => {
    const ids = new Set(ROWS.map((row) => row.id));

    expect(ids.size).toBe(ROWS.length);
    expect(ROWS[0]!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('keeps transfers uncategorised, as the ledger rules require', () => {
    const transfers = ROWS.filter((row) => row.type === 'transfer');

    expect(transfers.length).toBeGreaterThan(0);
    expect(transfers.every((row) => row.category_id === null)).toBe(true);
    expect(transfers.every((row) => row.to_account_id !== row.account_id)).toBe(true);
  });

  it('returns newest first, the order the list renders in', () => {
    expect(ROWS[0]!.occurred_at >= ROWS[ROWS.length - 1]!.occurred_at).toBe(true);
  });

  it('never yields an amount that is not integer paise', () => {
    expect(ROWS.every((row) => Number.isSafeInteger(row.amount_paise))).toBe(true);
    expect(ROWS.every((row) => row.amount_paise > 0)).toBe(true);
  });

  it('batches for insertion rather than one enormous statement', () => {
    const batches = toBatches(ROWS);

    expect(batches.length).toBe(Math.ceil(ROWS.length / 250));
    expect(batches.flat()).toHaveLength(ROWS.length);
  });

  it('has a PRNG that stays inside the unit interval', () => {
    const random = createRandom(1);
    const values = Array.from({ length: 1000 }, random);

    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(seededId(createRandom(1))).toBe(seededId(createRandom(1)));
  });
});

describe('the screens stay within budget at 10,000 transactions', () => {
  it('groups a page of the list well inside a frame budget', () => {
    // This is what the transactions screen actually does per render: one page,
    // not the whole ledger.
    const page = ROWS.slice(0, PAGE_SIZE);

    const elapsed = timed(() => toListItems(groupByDay(page)));

    expect(elapsed).toBeLessThan(150);
  });

  it('groups the entire ledger without going quadratic', () => {
    // Not a thing the app does - but if this is slow, grouping is O(n^2) and
    // paging is only hiding it.
    const elapsed = timed(() => toListItems(groupByDay(ROWS)));

    expect(elapsed).toBeLessThan(2000);
  });

  it('totals a period over the whole ledger quickly', () => {
    const elapsed = timed(() => periodTotals(ROWS));

    expect(elapsed).toBeLessThan(500);
  });

  it('computes account balances over the whole ledger quickly', () => {
    const openings = ACCOUNTS.map((id) => ({ id, opening_balance_paise: 100000 }));

    const elapsed = timed(() => accountBalances(openings, ROWS));

    expect(elapsed).toBeLessThan(500);
  });

  it('builds the report slices from an aggregated result, not from rows', () => {
    // The reports aggregate in SQL, so this only ever sees one row per
    // category however large the ledger is.
    const aggregated = CATEGORIES.map((id, index) => ({
      category_id: id,
      spent_paise: (index + 1) * 10000,
      txn_count: index + 1,
    }));

    const elapsed = timed(() => buildCategorySlices(aggregated, [], 'light'));

    expect(elapsed).toBeLessThan(50);
  });
});
