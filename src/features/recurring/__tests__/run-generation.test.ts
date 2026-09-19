import { runRecurringGeneration } from '@/features/recurring/run-generation';
import { occurrenceId } from '@/features/recurring/generate';

const NOW = new Date(2026, 10, 19, 12, 0);
const RULE_ID = 'c1111111-1111-4111-8111-111111111111';

function makeRule(overrides: Record<string, unknown> = {}) {
  return {
    id: RULE_ID,
    type: 'expense',
    amount_paise: 2500000,
    account_id: 'acc-1',
    to_account_id: null,
    category_id: 'cat-rent',
    note: 'Rent',
    frequency: 'monthly',
    interval: 1,
    next_run_at: new Date(2026, 8, 1, 9, 0).toISOString(),
    end_at: null,
    is_active: 1,
    deleted_at: null,
    ...overrides,
  };
}

function makeDeps(rows: Record<string, unknown>[]) {
  const inserted: Record<string, unknown>[] = [];
  const updates: { id: string; values: Record<string, unknown> }[] = [];

  return {
    inserted,
    updates,
    deps: {
      now: NOW,
      rules: {
        listDue: jest.fn(async () => rows),
        update: jest.fn(async (id: string, values: Record<string, unknown>) => {
          updates.push({ id, values });
        }),
      } as never,
      transactions: {
        insertGenerated: jest.fn(async (values: Record<string, unknown>) => {
          inserted.push(values);
        }),
      } as never,
    },
  };
}

describe('runRecurringGeneration', () => {
  it('does nothing when no rule is due', async () => {
    const { deps, inserted } = makeDeps([]);

    expect(await runRecurringGeneration(deps)).toEqual({
      created: 0,
      rulesAdvanced: 0,
      rulesRetired: 0,
      truncated: false,
    });
    expect(inserted).toEqual([]);
  });

  it('creates every missed occurrence and advances the rule', async () => {
    const { deps, inserted, updates } = makeDeps([makeRule()]);

    const outcome = await runRecurringGeneration(deps);

    expect(outcome.created).toBe(3);
    expect(inserted.map((row) => (row.occurred_at as string).slice(0, 10))).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
    ]);
    expect(updates).toHaveLength(1);
    expect((updates[0]!.values.next_run_at as string).slice(0, 10)).toBe('2026-12-01');
  });

  it('writes the deterministic id, not a random one', async () => {
    const { deps, inserted } = makeDeps([makeRule()]);

    await runRecurringGeneration(deps);

    expect(inserted[0]!.id).toBe(occurrenceId(RULE_ID, new Date(2026, 8, 1, 9, 0)));
  });

  it('is idempotent: a second run produces the same ids', async () => {
    const first = makeDeps([makeRule()]);
    await runRecurringGeneration(first.deps);

    const second = makeDeps([makeRule()]);
    await runRecurringGeneration(second.deps);

    expect(second.inserted.map((row) => row.id)).toEqual(first.inserted.map((row) => row.id));
  });

  it('retires a rule that has passed its end date', async () => {
    const { deps, updates } = makeDeps([makeRule({ end_at: new Date(2026, 9, 15).toISOString() })]);

    const outcome = await runRecurringGeneration(deps);

    expect(outcome.rulesRetired).toBe(1);
    expect(updates[0]!.values).toEqual({ is_active: 0 });
  });

  it('carries the template onto each generated row', async () => {
    const { deps, inserted } = makeDeps([makeRule()]);

    await runRecurringGeneration(deps);

    expect(inserted[0]).toMatchObject({
      type: 'expense',
      amount_paise: 2500000,
      account_id: 'acc-1',
      category_id: 'cat-rent',
      note: 'Rent',
      recurring_rule_id: RULE_ID,
    });
  });

  it('reports truncation so a long-abandoned rule is visible', async () => {
    const { deps } = makeDeps([
      makeRule({ frequency: 'daily', next_run_at: new Date(2000, 0, 1).toISOString() }),
    ]);

    const outcome = await runRecurringGeneration(deps);

    expect(outcome.truncated).toBe(true);
    expect(outcome.created).toBe(200);
  });

  it('handles several rules in one pass', async () => {
    const { deps, inserted } = makeDeps([
      makeRule(),
      makeRule({
        id: 'd2222222-2222-4222-8222-222222222222',
        next_run_at: new Date(2026, 10, 1).toISOString(),
        note: 'Gym',
      }),
    ]);

    await runRecurringGeneration(deps);

    expect(new Set(inserted.map((row) => row.recurring_rule_id)).size).toBe(2);
  });
});
