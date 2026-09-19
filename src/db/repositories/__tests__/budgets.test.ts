import { BudgetsRepository } from '@/db/repositories/budgets';
import { createMockDatabase, type MockDatabase } from '@/test-utils/mock-database';

const USER_ID = 'a1111111-1111-4111-8111-111111111111';
const FIXED_NOW = new Date('2026-09-19T10:30:00.000Z');

describe('BudgetsRepository.copyFrom', () => {
  let db: MockDatabase;
  let repo: BudgetsRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new BudgetsRepository({ db, userId: USER_ID, now: () => FIXED_NOW });
  });

  it('copies each budget forward with its limit', async () => {
    db.queueRows([
      { id: 'b1', category_id: 'food', limit_paise: 1000000, month: '2026-08-01' },
      { id: 'b2', category_id: 'fuel', limit_paise: 500000, month: '2026-08-01' },
    ]);
    db.queueRows([]);

    expect(await repo.copyFrom('2026-08-01', '2026-09-01')).toBe(2);

    const inserts = db.writes.filter((call) => call.sql.startsWith('INSERT INTO budgets'));
    expect(inserts).toHaveLength(2);
    expect(inserts[0]!.parameters).toContain('2026-09-01');
    expect(inserts[0]!.parameters).toContain(1000000);
  });

  it('clears the alert flags, so a new month starts quiet', async () => {
    db.queueRows([
      { id: 'b1', category_id: 'food', limit_paise: 1000000, alert_80_sent: 1, alert_100_sent: 1 },
    ]);
    db.queueRows([]);

    await repo.copyFrom('2026-08-01', '2026-09-01');

    const insert = db.writes.find((call) => call.sql.startsWith('INSERT INTO budgets'))!;
    // The flags are written as 0 rather than carried over.
    expect(insert.sql).toContain('alert_80_sent');
    expect(insert.parameters.filter((value) => value === 0).length).toBeGreaterThanOrEqual(2);
  });

  it('skips a category already budgeted in the target month', async () => {
    db.queueRows([
      { id: 'b1', category_id: 'food', limit_paise: 1000000 },
      { id: 'b2', category_id: 'fuel', limit_paise: 500000 },
    ]);
    db.queueRows([{ id: 'existing', category_id: 'food', limit_paise: 2000000 }]);

    expect(await repo.copyFrom('2026-08-01', '2026-09-01')).toBe(1);
  });

  it('is idempotent: running it twice adds nothing the second time', async () => {
    db.queueRows([{ id: 'b1', category_id: 'food', limit_paise: 1000000 }]);
    db.queueRows([{ id: 'copied', category_id: 'food', limit_paise: 1000000 }]);

    expect(await repo.copyFrom('2026-08-01', '2026-09-01')).toBe(0);
    expect(db.writes.filter((call) => call.sql.startsWith('INSERT'))).toHaveLength(0);
  });

  it('copies nothing from an empty month', async () => {
    db.queueRows([]);
    db.queueRows([]);

    expect(await repo.copyFrom('2026-08-01', '2026-09-01')).toBe(0);
  });
});

describe('BudgetsRepository.setLimit', () => {
  let db: MockDatabase;
  let repo: BudgetsRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new BudgetsRepository({ db, userId: USER_ID, now: () => FIXED_NOW });
  });

  it('clears the alert flags when the limit is raised', async () => {
    await repo.setLimit('b1', 2000000, 1000000);

    const call = db.lastCall()!;
    expect(call.sql).toContain('alert_80_sent = ?');
    expect(call.sql).toContain('alert_100_sent = ?');
  });

  it('leaves the flags alone when the limit is lowered', async () => {
    await repo.setLimit('b1', 500000, 1000000);

    const call = db.lastCall()!;
    expect(call.sql).not.toContain('alert_80_sent');
  });

  it('leaves the flags alone when the limit is unchanged', async () => {
    await repo.setLimit('b1', 1000000, 1000000);
    expect(db.lastCall()!.sql).not.toContain('alert_80_sent');
  });
});

describe('BudgetsRepository.countForMonth', () => {
  it('counts live budgets in a month', async () => {
    const db = createMockDatabase();
    const repo = new BudgetsRepository({ db, userId: USER_ID, now: () => FIXED_NOW });
    db.queueRow({ count: 4 });

    expect(await repo.countForMonth('2026-08-01')).toBe(4);
    expect(db.lastCall()!.sql).toContain('deleted_at IS NULL');
  });

  it('reports zero when the month is empty', async () => {
    const db = createMockDatabase();
    const repo = new BudgetsRepository({ db, userId: USER_ID, now: () => FIXED_NOW });

    expect(await repo.countForMonth('2026-08-01')).toBe(0);
  });
});
