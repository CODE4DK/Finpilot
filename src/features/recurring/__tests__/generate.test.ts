import {
  RECURRING_NAMESPACE,
  isRunnable,
  occurrenceId,
  occurrenceName,
  planForRule,
  planGeneration,
  type RecurringRuleLike,
} from '@/features/recurring/generate';
import { isUuid } from '@/utils/id';

const RULE_ID = 'c1111111-1111-4111-8111-111111111111';

function rule(overrides: Partial<RecurringRuleLike> = {}): RecurringRuleLike {
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

describe('occurrenceId', () => {
  it('is a valid UUID', () => {
    expect(isUuid(occurrenceId(RULE_ID, new Date(2026, 8, 1)))).toBe(true);
  });

  it('is a v5 UUID - deterministic, not random', () => {
    const id = occurrenceId(RULE_ID, new Date(2026, 8, 1));
    // Version nibble is 5.
    expect(id[14]).toBe('5');
  });

  it('is identical for the same rule and occurrence', () => {
    const occurredAt = new Date(2026, 8, 1, 9, 0);
    expect(occurrenceId(RULE_ID, occurredAt)).toBe(occurrenceId(RULE_ID, occurredAt));
  });

  it('depends only on the instant, not on how the Date was built', () => {
    // Two devices in different timezones describing the same moment must
    // arrive at the same id.
    const instant = Date.UTC(2026, 8, 1, 9, 0);
    expect(occurrenceId(RULE_ID, new Date(instant))).toBe(
      occurrenceId(RULE_ID, new Date(new Date(instant).toISOString())),
    );
  });

  it('differs for a different occurrence of the same rule', () => {
    expect(occurrenceId(RULE_ID, new Date(2026, 8, 1))).not.toBe(
      occurrenceId(RULE_ID, new Date(2026, 9, 1)),
    );
  });

  it('differs for the same occurrence of a different rule', () => {
    expect(occurrenceId(RULE_ID, new Date(2026, 8, 1))).not.toBe(
      occurrenceId('d2222222-2222-4222-8222-222222222222', new Date(2026, 8, 1)),
    );
  });

  it('builds the hashed name from the rule and the instant', () => {
    expect(occurrenceName(RULE_ID, new Date(Date.UTC(2026, 8, 1, 9, 0)))).toBe(
      `${RULE_ID}:2026-09-01T09:00:00.000Z`,
    );
  });

  it('uses a fixed namespace, which must never change', () => {
    // Pinned deliberately: changing it would orphan every id already generated.
    expect(RECURRING_NAMESPACE).toBe('9f4b8a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b');
  });

  it('produces a known id for a known input, so the scheme cannot drift', () => {
    expect(occurrenceId('rule', new Date(Date.UTC(2026, 8, 1, 9, 0)))).toBe(
      'a66d7344-5023-5326-a9a7-07ea94dcb2e7',
    );
  });
});

describe('isRunnable', () => {
  it('skips paused and deleted rules', () => {
    expect(isRunnable(rule())).toBe(true);
    expect(isRunnable(rule({ is_active: 0 }))).toBe(false);
    expect(isRunnable(rule({ deleted_at: new Date().toISOString() }))).toBe(false);
  });
});

describe('planForRule', () => {
  const now = new Date(2026, 10, 19, 12, 0);

  it('generates every missed occurrence', () => {
    const plan = planForRule(rule(), now);

    expect(plan.transactions.map((t) => t.occurred_at.slice(0, 10))).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
    ]);
  });

  it('copies the template onto every generated transaction', () => {
    const [first] = planForRule(rule(), now).transactions;

    expect(first).toMatchObject({
      type: 'expense',
      amount_paise: 2500000,
      account_id: 'acc-1',
      category_id: 'cat-rent',
      note: 'Rent',
      recurring_rule_id: RULE_ID,
    });
  });

  it('advances next_run_at past the last occurrence', () => {
    const plan = planForRule(rule(), now);
    expect(plan.nextRunAt?.slice(0, 10)).toBe('2026-12-01');
    expect(plan.stillActive).toBe(true);
  });

  it('generates nothing for a paused rule and leaves its schedule alone', () => {
    const paused = rule({ is_active: 0 });
    const plan = planForRule(paused, now);

    expect(plan.transactions).toEqual([]);
    expect(plan.nextRunAt).toBe(paused.next_run_at);
  });

  it('generates nothing for a deleted rule', () => {
    expect(planForRule(rule({ deleted_at: now.toISOString() }), now).transactions).toEqual([]);
  });

  it('generates nothing when the next run is still in the future', () => {
    const plan = planForRule(rule({ next_run_at: new Date(2027, 0, 1).toISOString() }), now);
    expect(plan.transactions).toEqual([]);
    expect(plan.stillActive).toBe(true);
  });

  it('retires a rule that has passed its end date', () => {
    const plan = planForRule(rule({ end_at: new Date(2026, 9, 15).toISOString() }), now);

    expect(plan.transactions.map((t) => t.occurred_at.slice(0, 10))).toEqual([
      '2026-09-01',
      '2026-10-01',
    ]);
    expect(plan.nextRunAt).toBeNull();
    expect(plan.stillActive).toBe(false);
  });

  it('carries a transfer template through, with no category', () => {
    const plan = planForRule(
      rule({ type: 'transfer', to_account_id: 'acc-2', category_id: null }),
      now,
    );

    expect(plan.transactions[0]).toMatchObject({
      type: 'transfer',
      to_account_id: 'acc-2',
      category_id: null,
    });
  });

  it('keeps the month anchor across short months', () => {
    const plan = planForRule(
      rule({ next_run_at: new Date(2026, 0, 31, 9, 0).toISOString() }),
      new Date(2026, 3, 15),
    );

    expect(plan.transactions.map((t) => t.occurred_at.slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('produces the same ids when run twice - the idempotency guarantee', () => {
    const first = planForRule(rule(), now).transactions.map((t) => t.id);
    const second = planForRule(rule(), now).transactions.map((t) => t.id);

    expect(first).toEqual(second);
  });

  it('produces the same ids on two devices catching up differently', () => {
    // Device A has been offline since September and catches up three at once.
    const deviceA = planForRule(rule(), now).transactions.map((t) => t.id);

    // Device B generated September on time, then caught up the rest later.
    const september = planForRule(rule(), new Date(2026, 8, 5)).transactions;
    const rest = planForRule(
      rule({ next_run_at: september.at(-1) ? '2026-10-01T03:30:00.000Z' : rule().next_run_at }),
      now,
    );
    const deviceB = [...september.map((t) => t.id), ...rest.transactions.map((t) => t.id)];

    // The September occurrence is byte-identical on both devices.
    expect(deviceB[0]).toBe(deviceA[0]);
  });
});

describe('planGeneration', () => {
  const now = new Date(2026, 10, 19, 12, 0);

  it('plans across several rules', () => {
    const plan = planGeneration(
      [
        rule(),
        rule({
          id: 'd2222222-2222-4222-8222-222222222222',
          frequency: 'weekly',
          next_run_at: new Date(2026, 10, 1).toISOString(),
          note: 'Gym',
        }),
      ],
      now,
    );

    expect(plan.rules).toHaveLength(2);
    expect(plan.transactions.length).toBeGreaterThan(3);
    expect(plan.hasWork).toBe(true);
  });

  it('reports no work when nothing is due', () => {
    const plan = planGeneration([rule({ next_run_at: new Date(2027, 0, 1).toISOString() })], now);

    expect(plan.transactions).toEqual([]);
    expect(plan.hasWork).toBe(false);
  });

  it('reports no work for an empty rule list', () => {
    expect(planGeneration([], now)).toEqual({ rules: [], transactions: [], hasWork: false });
  });

  it('generates unique ids across rules firing on the same day', () => {
    const plan = planGeneration(
      [
        rule({ next_run_at: new Date(2026, 10, 1).toISOString() }),
        rule({
          id: 'd2222222-2222-4222-8222-222222222222',
          next_run_at: new Date(2026, 10, 1).toISOString(),
        }),
      ],
      now,
    );

    const ids = plan.transactions.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
