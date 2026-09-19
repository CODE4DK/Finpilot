import { TransactionsRepository, escapeLike } from '@/db/repositories/transactions';
import { createMockDatabase, type MockDatabase } from '@/test-utils/mock-database';

const USER_ID = 'a1111111-1111-4111-8111-111111111111';
const FIXED_NOW = new Date('2026-09-19T10:30:00.000Z');

describe('TransactionsRepository.listQuery', () => {
  let db: MockDatabase;
  let repo: TransactionsRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new TransactionsRepository({ db, userId: USER_ID, now: () => FIXED_NOW });
  });

  it('scopes to the owner and hides deleted rows by default', () => {
    const { sql, parameters } = repo.listQuery();

    expect(sql).toContain('WHERE user_id = ? AND deleted_at IS NULL');
    expect(sql).toContain('ORDER BY occurred_at DESC');
    expect(parameters).toEqual([USER_ID]);
  });

  it('filters a half-open date range', () => {
    const { sql, parameters } = repo.listQuery({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    });

    expect(sql).toContain('occurred_at >= ?');
    expect(sql).toContain('occurred_at < ?');
    expect(parameters).toEqual([USER_ID, '2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z']);
  });

  it('filters by type with one placeholder per value', () => {
    const { sql, parameters } = repo.listQuery({ types: ['income', 'expense'] });

    expect(sql).toContain('type IN (?, ?)');
    expect(parameters).toEqual([USER_ID, 'income', 'expense']);
  });

  it('matches an account on either side of a transfer', () => {
    const { sql, parameters } = repo.listQuery({ accountIds: ['acc-1'] });

    expect(sql).toContain('(account_id IN (?) OR to_account_id IN (?))');
    expect(parameters).toEqual([USER_ID, 'acc-1', 'acc-1']);
  });

  it('filters by category', () => {
    const { sql, parameters } = repo.listQuery({ categoryIds: ['cat-1', 'cat-2'] });

    expect(sql).toContain('category_id IN (?, ?)');
    expect(parameters).toEqual([USER_ID, 'cat-1', 'cat-2']);
  });

  it('searches notes without letting the user inject a wildcard', () => {
    const { sql, parameters } = repo.listQuery({ search: '100% off_er' });

    expect(sql).toContain('note LIKE ? ESCAPE ?');
    expect(parameters[1]).toBe('%100\\% off\\_er%');
  });

  it('filters by amount range, in paise', () => {
    const { sql, parameters } = repo.listQuery({ minAmountPaise: 10000, maxAmountPaise: 500000 });

    expect(sql).toContain('amount_paise >= ?');
    expect(sql).toContain('amount_paise <= ?');
    expect(parameters).toEqual([USER_ID, 10000, 500000]);
  });

  it('keeps a zero bound rather than treating it as absent', () => {
    const { parameters } = repo.listQuery({ minAmountPaise: 0 });
    expect(parameters).toEqual([USER_ID, 0]);
  });

  it('paginates', () => {
    const { sql, parameters } = repo.listQuery({ limit: 20, offset: 40 });

    expect(sql).toContain('LIMIT ?');
    expect(sql).toContain('OFFSET ?');
    expect(parameters).toEqual([USER_ID, 20, 40]);
  });

  it('ignores an offset with no limit, which SQLite would reject', () => {
    const { sql } = repo.listQuery({ offset: 40 });
    expect(sql).not.toContain('OFFSET');
  });

  it('combines every filter in one statement', () => {
    const { sql, parameters } = repo.listQuery({
      from: '2026-09-01T00:00:00.000Z',
      types: ['expense'],
      accountIds: ['acc-1'],
      categoryIds: ['cat-1'],
      search: 'chai',
      limit: 10,
    });

    expect(sql.match(/\?/g)).toHaveLength(parameters.length);
  });
});

describe('TransactionsRepository reads', () => {
  let db: MockDatabase;
  let repo: TransactionsRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new TransactionsRepository({ db, userId: USER_ID, now: () => FIXED_NOW });
  });

  it('returns the rows the database gives it', async () => {
    db.queueRows([{ id: 't1', amount_paise: 184550 }]);

    const rows = await repo.listFiltered({ types: ['expense'] });
    expect(rows).toEqual([{ id: 't1', amount_paise: 184550 }]);
  });

  it('sums income and expense over a period', async () => {
    db.queueRow({ income_paise: 8500000, expense_paise: 3245600 });

    expect(await repo.totals('2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')).toEqual({
      income_paise: 8500000,
      expense_paise: 3245600,
    });
  });

  it('reports zeroes for a period with no transactions', async () => {
    expect(await repo.totals('2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')).toEqual({
      income_paise: 0,
      expense_paise: 0,
    });
  });

  it('groups spend by category, expenses only', async () => {
    const { sql } = repo.spendByCategoryQuery(
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
    );

    expect(sql).toContain("type = 'expense'");
    expect(sql).toContain('GROUP BY category_id');
  });
});

describe('TransactionsRepository writes', () => {
  let db: MockDatabase;
  let repo: TransactionsRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new TransactionsRepository({ db, userId: USER_ID, now: () => FIXED_NOW });
  });

  it('defaults occurred_at to now', async () => {
    await repo.insert({
      type: 'expense',
      amount_paise: 184550,
      account_id: 'acc-1',
      category_id: 'cat-1',
    });

    const call = db.lastCall()!;
    expect(call.sql).toContain('occurred_at');
    expect(call.parameters).toContain(FIXED_NOW.toISOString());
  });

  it('keeps a backdated occurred_at', async () => {
    await repo.insert({
      type: 'expense',
      amount_paise: 100,
      account_id: 'acc-1',
      category_id: 'cat-1',
      occurred_at: '2026-08-01T00:00:00.000Z',
    });

    expect(db.lastCall()!.parameters).toContain('2026-08-01T00:00:00.000Z');
  });

  it('writes the amount as an integer number of paise', async () => {
    await repo.insert({
      type: 'expense',
      amount_paise: 184550,
      account_id: 'acc-1',
      category_id: 'cat-1',
    });

    const amount = db.lastCall()!.parameters.find((value) => value === 184550);
    expect(Number.isInteger(amount)).toBe(true);
  });
});

describe('escapeLike', () => {
  it.each([
    ['plain', 'plain'],
    ['100%', '100\\%'],
    ['under_score', 'under\\_score'],
    ['back\\slash', 'back\\\\slash'],
  ])('escapes %p', (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });
});
