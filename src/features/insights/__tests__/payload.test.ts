/**
 * The leak test.
 *
 * `buildInsightPayload` is the only thing standing between a user's ledger
 * and a third-party API, so this file is deliberately paranoid: it feeds the
 * builder rows carrying every piece of sensitive text the schema can hold and
 * then asserts, on the serialised payload, that none of it survived.
 *
 * The module under test lives in the Edge Function (Deno) but imports nothing
 * from it, precisely so this can run here.
 */

import {
  ALLOWED_PAYLOAD_KEYS,
  buildInsightPayload,
  buildLabelMap,
  hydrateLabels,
  MAX_CATEGORIES,
  toRupees,
  type RawInsightInput,
} from '../../../../supabase/functions/generate-insights/payload';

/** Strings that must never appear in anything the payload serialises to. */
const SECRETS = {
  note: 'loan to Ravi, card 4242',
  accountName: 'HDFC salary account',
  goalName: "Meera's wedding fund",
  email: 'wizard2dk@example.com',
  merchant: 'Big Bazaar Andheri',
};

function input(overrides: Partial<RawInsightInput> = {}): RawInsightInput {
  return {
    month: '2026-09-01',
    currency: 'INR',
    elapsedDays: 19,
    daysInMonth: 30,
    current: { income_paise: 9000000, expense_paise: 730000, expense_count: 12 },
    previous: { income_paise: 9000000, expense_paise: 610000, expense_count: 14 },
    currentCategories: [
      { category_name: 'Rent', spent_paise: 500000, txn_count: 1 },
      { category_name: 'Food', spent_paise: 200000, txn_count: 9 },
      { category_name: null, spent_paise: 30000, txn_count: 2 },
    ],
    previousCategories: [
      { category_name: 'Rent', spent_paise: 500000, txn_count: 1 },
      { category_name: 'Food', spent_paise: 110000, txn_count: 11 },
    ],
    budgets: [{ category_name: 'Food', limit_paise: 250000, spent_paise: 200000 }],
    goals: [
      {
        name: SECRETS.goalName,
        target_paise: 50000000,
        saved_paise: 10000000,
        target_date: '2027-03-01',
      },
    ],
    ...overrides,
  };
}

describe('what leaves the device', () => {
  it('carries no goal name - only an opaque label', () => {
    const serialised = JSON.stringify(buildInsightPayload(input()));

    expect(serialised).not.toContain(SECRETS.goalName);
    expect(serialised).not.toContain('Meera');
    expect(serialised).toContain('goal_1');
  });

  it('carries nothing a row happens to be carrying beside it', () => {
    // Rows with every sensitive field the builder could reach if someone
    // spread an input object into the output by mistake.
    const contaminated = {
      ...input(),
      currentCategories: [
        {
          category_name: 'Food',
          spent_paise: 200000,
          txn_count: 9,
          note: SECRETS.note,
          account_name: SECRETS.accountName,
          merchant: SECRETS.merchant,
        } as never,
      ],
      goals: [
        {
          name: SECRETS.goalName,
          target_paise: 50000000,
          saved_paise: 10000000,
          target_date: null,
          email: SECRETS.email,
        } as never,
      ],
    };

    const serialised = JSON.stringify(buildInsightPayload(contaminated));

    for (const secret of Object.values(SECRETS)) {
      expect(serialised).not.toContain(secret);
    }
  });

  it('contains no key outside the allow-list, at any depth', () => {
    const payload = buildInsightPayload(input());
    const allowed = new Set<string>(ALLOWED_PAYLOAD_KEYS);

    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          expect(allowed.has(key)).toBe(true);
          walk(child);
        }
      }
    };

    walk(payload);
  });

  it('never sends an id of any kind', () => {
    const serialised = JSON.stringify(buildInsightPayload(input()));

    expect(serialised).not.toMatch(/"[a-z_]*id"/i);
    expect(serialised).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('sends totals, never individual transactions', () => {
    const payload = buildInsightPayload(input());

    expect(payload.categories.every((category) => 'amount' in category)).toBe(true);
    expect(JSON.stringify(payload)).not.toContain('occurred_at');
  });
});

describe('the figures', () => {
  it('converts paise to rupees, because that is what the model reads', () => {
    expect(toRupees(123450)).toBe(1234.5);
    expect(toRupees(5)).toBe(0.05);
    expect(buildInsightPayload(input()).totals.expense).toBe(7300);
  });

  it('ranks categories and gives each a share and a change', () => {
    const payload = buildInsightPayload(input());

    expect(payload.categories[0]!.category).toBe('Rent');
    expect(payload.categories[1]).toMatchObject({
      category: 'Food',
      amount: 2000,
      previous_amount: 1100,
      change_percent: 81.8,
    });
  });

  it('names an uncategorised bucket rather than sending null', () => {
    expect(buildInsightPayload(input()).categories[2]!.category).toBe('Uncategorised');
  });

  it('calls a category with no history new rather than infinite', () => {
    const payload = buildInsightPayload(
      input({
        previousCategories: [],
        currentCategories: [{ category_name: 'Food', spent_paise: 200000, txn_count: 1 }],
      }),
    );

    expect(payload.categories[0]!.change_percent).toBeNull();
  });

  it('caps how many categories are sent', () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      category_name: `Category ${index}`,
      spent_paise: (30 - index) * 1000,
      txn_count: 1,
    }));

    expect(buildInsightPayload(input({ currentCategories: many })).categories).toHaveLength(
      MAX_CATEGORIES,
    );
  });

  it('divides the daily average by the days lived, not the whole month', () => {
    // 7300 rupees over 19 days, not over 30.
    expect(buildInsightPayload(input()).totals.daily_average_expense).toBe(384.21);
  });

  it('never divides by zero days', () => {
    expect(buildInsightPayload(input({ elapsedDays: 0 })).totals.daily_average_expense).toBe(7300);
  });
});

describe('label hydration', () => {
  it('maps each goal to a label in order', () => {
    expect(
      buildLabelMap([
        { name: 'Wedding', target_paise: 1, saved_paise: 0, target_date: null },
        { name: 'Laptop', target_paise: 1, saved_paise: 0, target_date: null },
      ]),
    ).toEqual({ goal_1: 'Wedding', goal_2: 'Laptop' });
  });

  it('puts the real name back into the model text', () => {
    expect(hydrateLabels('You are 20% of the way to goal_1.', { goal_1: 'Wedding' })).toBe(
      'You are 20% of the way to Wedding.',
    );
  });

  it('does not let goal_1 eat the front of goal_10', () => {
    const labels = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`goal_${index + 1}`, `Goal ${index + 1}`]),
    );

    expect(hydrateLabels('goal_10 and goal_1', labels)).toBe('Goal 10 and Goal 1');
  });

  it('leaves text alone when there are no goals', () => {
    expect(hydrateLabels('Nothing to substitute.', {})).toBe('Nothing to substitute.');
  });
});
