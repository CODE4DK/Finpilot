import { AccountsRepository } from '@/db/repositories/accounts';
import { BudgetsRepository, toMonthKey } from '@/db/repositories/budgets';
import { CategoriesRepository } from '@/db/repositories/categories';
import { GoalContributionsRepository, GoalsRepository } from '@/db/repositories/goals';
import { InsightsRepository } from '@/db/repositories/insights';
import { ProfilesRepository } from '@/db/repositories/profiles';
import { RecurringRulesRepository } from '@/db/repositories/recurring-rules';
import { createMockDatabase, type MockDatabase } from '@/test-utils/mock-database';

const USER_ID = 'a1111111-1111-4111-8111-111111111111';
const FIXED_NOW = new Date('2026-09-19T10:30:00.000Z');

function context(db: MockDatabase) {
  return { db, userId: USER_ID, now: () => FIXED_NOW };
}

describe('AccountsRepository', () => {
  let db: MockDatabase;
  let repo: AccountsRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new AccountsRepository(context(db));
  });

  it('lists active accounts before archived ones', () => {
    expect(repo.listQuery().sql).toContain('ORDER BY is_archived ASC, name COLLATE NOCASE ASC');
  });

  it('can list only the active ones', async () => {
    await repo.listActive();
    expect(db.lastCall()!.sql).toContain('is_archived = 0');
  });

  it('archives without deleting, so history keeps its account', async () => {
    await repo.setArchived('acc-1', true);

    const call = db.lastCall()!;
    expect(call.sql).toContain('UPDATE accounts SET is_archived = ?');
    expect(call.parameters[0]).toBe(1);
  });

  it('computes a balance from the opening balance and both sides of a transfer', () => {
    const { sql, parameters } = repo.balanceQuery('acc-1');

    expect(sql).toContain('opening_balance_paise');
    expect(sql).toContain("WHEN 'income' THEN t.amount_paise");
    expect(sql).toContain('t.to_account_id = a.id');
    expect(parameters).toEqual(['acc-1', USER_ID]);
  });

  it('reports a zero balance for an unknown account rather than throwing', async () => {
    expect(await repo.balance('missing')).toBe(0);
  });

  it('returns the computed balance', async () => {
    db.queueRow({ balance_paise: 12456700 });
    expect(await repo.balance('acc-1')).toBe(12456700);
  });
});

describe('CategoriesRepository', () => {
  let db: MockDatabase;
  let repo: CategoriesRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new CategoriesRepository(context(db));
  });

  it('lists alphabetically, case-insensitively', () => {
    expect(repo.listQuery().sql).toContain('ORDER BY name COLLATE NOCASE ASC');
  });

  it('filters by type', () => {
    const { sql, parameters } = repo.listQuery('expense');
    expect(sql).toContain('type = ?');
    expect(parameters).toEqual([USER_ID, 'expense']);
  });

  it('lists sub-categories of a parent', async () => {
    await repo.listChildren('cat-1');

    const call = db.lastCall()!;
    expect(call.sql).toContain('parent_id = ?');
    expect(call.parameters).toEqual([USER_ID, 'cat-1']);
  });
});

describe('BudgetsRepository', () => {
  let db: MockDatabase;
  let repo: BudgetsRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new BudgetsRepository(context(db));
  });

  it('keys months to the first of the month', () => {
    expect(toMonthKey(new Date('2026-09-19T10:30:00.000Z'))).toBe('2026-09-01');
    expect(toMonthKey(new Date('2026-01-31T23:00:00.000Z'))).toMatch(/^2026-0[12]-01$/);
  });

  it('lists a single month', () => {
    const { sql, parameters } = repo.listQuery('2026-09-01');
    expect(sql).toContain('month = ?');
    expect(parameters).toEqual([USER_ID, '2026-09-01']);
  });

  it('joins spend in one query rather than N', () => {
    const { sql } = repo.progressQuery('2026-09-01');

    expect(sql).toContain('FROM transactions t');
    expect(sql).toContain("t.type = 'expense'");
    // The month window is derived in SQL, so it cannot drift from the key.
    expect(sql).toContain("date(b.month, '+1 month')");
  });

  it('counts only live transactions toward a budget', () => {
    expect(repo.progressQuery('2026-09-01').sql).toContain('t.deleted_at IS NULL');
  });

  it('finds an existing budget for a category', async () => {
    await repo.findForCategory('cat-1', '2026-09-01');

    expect(db.lastCall()!.parameters).toEqual([USER_ID, 'cat-1', '2026-09-01']);
  });
});

describe('GoalsRepository', () => {
  let db: MockDatabase;
  let repo: GoalsRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new GoalsRepository(context(db));
  });

  it('sums contributions alongside each goal', () => {
    const { sql } = repo.listQuery();

    expect(sql).toContain('SUM(c.amount_paise)');
    expect(sql).toContain('c.deleted_at IS NULL');
  });

  it('orders active goals first, then by target date', () => {
    expect(repo.listQuery().sql).toContain("CASE g.status WHEN 'active' THEN 0");
  });

  it('filters by status when asked', () => {
    const { sql, parameters } = repo.listQuery('completed');
    expect(sql).toContain('g.status = ?');
    expect(parameters).toEqual([USER_ID, 'completed']);
  });

  it('changes status through an update, never a delete', async () => {
    await repo.setStatus('goal-1', 'archived');

    const call = db.lastCall()!;
    expect(call.sql).toContain('UPDATE goals SET status = ?');
    expect(call.parameters[0]).toBe('archived');
  });
});

describe('GoalContributionsRepository', () => {
  let db: MockDatabase;
  let repo: GoalContributionsRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new GoalContributionsRepository(context(db));
  });

  it('lists the contributions for a goal, newest first', () => {
    const { sql, parameters } = repo.listQuery('goal-1');
    expect(sql).toContain('ORDER BY contributed_at DESC');
    expect(parameters).toEqual([USER_ID, 'goal-1']);
  });

  it('defaults contributed_at to now', async () => {
    await repo.insert({ goal_id: 'goal-1', amount_paise: 1000000 });
    expect(db.lastCall()!.parameters).toContain(FIXED_NOW.toISOString());
  });
});

describe('RecurringRulesRepository', () => {
  let db: MockDatabase;
  let repo: RecurringRulesRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new RecurringRulesRepository(context(db));
  });

  it('lists active rules first, soonest next', () => {
    expect(repo.listQuery().sql).toContain('ORDER BY is_active DESC, next_run_at ASC');
  });

  it('finds rules that are due and not past their end date', async () => {
    await repo.listDue(FIXED_NOW.toISOString());

    const call = db.lastCall()!;
    expect(call.sql).toContain('is_active = 1');
    expect(call.sql).toContain('next_run_at <= ?');
    expect(call.sql).toContain('(end_at IS NULL OR end_at >= ?)');
    expect(call.parameters).toEqual([USER_ID, FIXED_NOW.toISOString(), FIXED_NOW.toISOString()]);
  });

  it('pauses a rule without deleting it', async () => {
    await repo.setActive('rule-1', false);
    expect(db.lastCall()!.parameters[0]).toBe(0);
  });
});

describe('InsightsRepository', () => {
  let db: MockDatabase;
  let repo: InsightsRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new InsightsRepository(context(db));
  });

  it('lists newest month first', () => {
    expect(repo.listQuery().sql).toContain('ORDER BY month DESC');
  });

  it('finds one month', async () => {
    await repo.findForMonth('2026-09-01');
    expect(db.lastCall()!.parameters).toEqual([USER_ID, '2026-09-01']);
  });
});

describe('ProfilesRepository', () => {
  let db: MockDatabase;
  let repo: ProfilesRepository;

  beforeEach(() => {
    db = createMockDatabase();
    repo = new ProfilesRepository(context(db));
  });

  it('reads the row whose id is the user id', () => {
    const { sql, parameters } = repo.currentQuery();
    expect(sql).toContain('WHERE id = ?');
    expect(parameters).toEqual([USER_ID]);
  });

  it('toggles the AI opt-in as an integer', async () => {
    await repo.setAiInsightsOptIn(true);

    const call = db.lastCall()!;
    expect(call.sql).toContain('UPDATE profiles SET ai_insights_opt_in = ?');
    expect(call.parameters[0]).toBe(1);
  });
});

describe('every repository', () => {
  it('scopes its list query to the owner and excludes deleted rows', () => {
    const db = createMockDatabase();
    const queries = [
      new AccountsRepository(context(db)).listQuery(),
      new CategoriesRepository(context(db)).listQuery(),
      new BudgetsRepository(context(db)).listQuery('2026-09-01'),
      new GoalsRepository(context(db)).listQuery(),
      new GoalContributionsRepository(context(db)).listQuery('goal-1'),
      new RecurringRulesRepository(context(db)).listQuery(),
      new InsightsRepository(context(db)).listQuery(),
      new ProfilesRepository(context(db)).currentQuery(),
    ];

    for (const { sql, parameters } of queries) {
      expect(sql).toContain('deleted_at IS NULL');
      expect(parameters[0]).toBe(USER_ID);
    }
  });
});
