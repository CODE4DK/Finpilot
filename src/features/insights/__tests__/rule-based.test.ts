import { buildRuleBasedInsight, type RuleInput } from '@/features/insights/rule-based';
import { parseInsight } from '@/features/insights/types';

const NOW = new Date('2026-09-19T10:00:00.000Z');

function input(overrides: Partial<RuleInput> = {}): RuleInput {
  return {
    monthLabel: 'September 2026',
    incomePaise: 9000000,
    expensePaise: 730000,
    previousExpensePaise: 610000,
    daysElapsed: 19,
    daysInMonth: 30,
    categories: [
      { name: 'Rent', spentPaise: 500000, previousPaise: 500000, txnCount: 1 },
      { name: 'Food', spentPaise: 200000, previousPaise: 110000, txnCount: 9 },
    ],
    budgets: [{ category: 'Food', limitPaise: 250000, spentPaise: 200000 }],
    goals: [
      { name: 'Emergency fund', targetPaise: 50000000, savedPaise: 10000000, targetDate: null },
    ],
    now: NOW,
    ...overrides,
  };
}

describe('the summary', () => {
  it('states both sides and the direction of travel', () => {
    const insight = buildRuleBasedInsight(input());

    expect(insight.summary).toContain('₹7,300');
    expect(insight.summary).toContain('₹90,000');
    expect(insight.summary).toContain('20% higher than last month');
  });

  it('says level rather than inventing a trend from a rounding difference', () => {
    const insight = buildRuleBasedInsight(input({ expensePaise: 620000 }));

    expect(insight.summary).toContain('about level with last month');
  });

  it('says plainly when there is nothing to report', () => {
    const insight = buildRuleBasedInsight(
      input({ incomePaise: 0, expensePaise: 0, categories: [], budgets: [], goals: [] }),
    );

    expect(insight.summary).toContain('Nothing recorded for September 2026 yet');
    expect(insight.highlights).toEqual([]);
    expect(insight.unusual_spend).toEqual([]);
  });

  it('is labelled as computed here, not written elsewhere', () => {
    expect(buildRuleBasedInsight(input()).source).toBe('rules');
    expect(buildRuleBasedInsight(input()).model).toBeUndefined();
  });
});

describe('highlights', () => {
  it('names the largest category with its share', () => {
    const [first] = buildRuleBasedInsight(input()).highlights;

    expect(first!.title).toBe('Rent is your largest category');
    expect(first!.detail).toContain('68%');
    expect(first!.detail).toContain('1 transaction');
  });

  it('projects the month only while the month is still running', () => {
    const running = buildRuleBasedInsight(input()).highlights[1]!;
    const finished = buildRuleBasedInsight(input({ daysElapsed: 30 })).highlights[1]!;

    expect(running.detail).toContain('At this pace');
    expect(finished.detail).toBe('Over the whole of September 2026.');
  });

  it('flags a large uncategorised share, because it makes everything else rougher', () => {
    const insight = buildRuleBasedInsight(
      input({
        categories: [
          { name: 'Rent', spentPaise: 500000, previousPaise: 500000, txnCount: 1 },
          { name: 'Uncategorised', spentPaise: 230000, previousPaise: 0, txnCount: 4 },
        ],
      }),
    );

    expect(insight.highlights.map((item) => item.title)).toContain(
      'A fifth of your spending has no category',
    );
  });
});

describe('unusual spend', () => {
  it('reports a category that is materially up', () => {
    const [first] = buildRuleBasedInsight(input()).unusual_spend;

    expect(first!.category).toBe('Food');
    expect(first!.detail).toContain('up 82%');
    expect(first!.severity).toBe('medium');
  });

  it('ignores a rise that is large in percent but trivial in rupees', () => {
    const insight = buildRuleBasedInsight(
      input({
        categories: [{ name: 'Tea', spentPaise: 20000, previousPaise: 2000, txnCount: 4 }],
      }),
    );

    // Ten times last month - but that is 180 rupees, which is not news.
    expect(insight.unusual_spend).toEqual([]);
  });

  it('ignores a rise that is large in rupees but small in proportion', () => {
    const insight = buildRuleBasedInsight(
      input({
        categories: [{ name: 'Rent', spentPaise: 5100000, previousPaise: 5000000, txnCount: 1 }],
      }),
    );

    expect(insight.unusual_spend).toEqual([]);
  });

  it('treats a brand-new category as the most severe kind of change', () => {
    const insight = buildRuleBasedInsight(
      input({
        categories: [{ name: 'Medical', spentPaise: 400000, previousPaise: 0, txnCount: 2 }],
      }),
    );

    expect(insight.unusual_spend[0]).toMatchObject({ category: 'Medical', severity: 'high' });
    expect(insight.unusual_spend[0]!.detail).toContain('nothing last month');
  });

  it('never claims a fall is unusual spending', () => {
    const insight = buildRuleBasedInsight(
      input({
        categories: [{ name: 'Food', spentPaise: 50000, previousPaise: 400000, txnCount: 2 }],
      }),
    );

    expect(insight.unusual_spend).toEqual([]);
  });

  it('puts the most severe first and stops at three', () => {
    const insight = buildRuleBasedInsight(
      input({
        categories: [
          { name: 'A', spentPaise: 140000, previousPaise: 100000, txnCount: 1 },
          { name: 'B', spentPaise: 300000, previousPaise: 0, txnCount: 1 },
          { name: 'C', spentPaise: 200000, previousPaise: 120000, txnCount: 1 },
          { name: 'D', spentPaise: 160000, previousPaise: 100000, txnCount: 1 },
        ],
      }),
    );

    expect(insight.unusual_spend).toHaveLength(3);
    expect(insight.unusual_spend[0]!.severity).toBe('high');
  });
});

describe('suggestions', () => {
  it('names a budget that has been blown', () => {
    const insight = buildRuleBasedInsight(
      input({ budgets: [{ category: 'Food', limitPaise: 150000, spentPaise: 200000 }] }),
    );

    expect(insight.suggestions[0]!.title).toBe('Food is over budget');
    expect(insight.suggestions[0]!.detail).toContain('₹2,000 against a ₹1,500 limit');
  });

  it('counts them when several are over', () => {
    const insight = buildRuleBasedInsight(
      input({
        budgets: [
          { category: 'Food', limitPaise: 150000, spentPaise: 200000 },
          { category: 'Travel', limitPaise: 100000, spentPaise: 130000 },
        ],
      }),
    );

    expect(insight.suggestions[0]!.title).toBe('2 budgets are over');
  });

  it('warns about a budget that is pacing over while there is still time', () => {
    // 2000 of a 2500 limit, on day 19 of 30 - it will not last the month.
    const insight = buildRuleBasedInsight(input());
    const pacing = insight.suggestions.find((item) => item.title.includes('pacing over'));

    expect(pacing).toBeDefined();
    expect(pacing!.detail).toContain('11 days');
  });

  it('does not warn about pacing once the month is done', () => {
    const insight = buildRuleBasedInsight(input({ daysElapsed: 30 }));

    expect(insight.suggestions.some((item) => item.title.includes('pacing over'))).toBe(false);
  });

  it('says what a goal still needs', () => {
    const insight = buildRuleBasedInsight(input({ budgets: [] }));
    const goal = insight.suggestions.find((item) => item.title.includes('Emergency fund'));

    expect(goal!.title).toContain('₹4,00,000 more');
    expect(goal!.detail).toContain('20%');
  });

  it('suggests a first budget only when there are none', () => {
    const withBudget = buildRuleBasedInsight(input());
    const without = buildRuleBasedInsight(input({ budgets: [] }));

    expect(withBudget.suggestions.some((item) => item.title.startsWith('Try a budget'))).toBe(
      false,
    );
    expect(without.suggestions.some((item) => item.title.startsWith('Try a budget'))).toBe(true);
  });
});

describe('round-tripping through storage', () => {
  it('survives being written as jsonb and read back', () => {
    const insight = buildRuleBasedInsight(input());
    const parsed = parseInsight(JSON.stringify(insight));

    expect(parsed).toEqual(insight);
  });
});
