import {
  alertCopy,
  collectAlerts,
  flagsForDeliveredAlert,
  pendingAlertsFor,
  shouldResetFlags,
  type BudgetAlert,
} from '@/features/budgets/alerts';
import { formatINR } from '@/utils/money';

const LIMIT = 1000000; // ₹10,000

function budget(overrides: Partial<Parameters<typeof pendingAlertsFor>[0]> = {}) {
  return {
    id: 'budget-1',
    category_id: 'cat-food',
    limit_paise: LIMIT,
    spent_paise: 0,
    alert_80_sent: 0,
    alert_100_sent: 0,
    ...overrides,
  };
}

describe('pendingAlertsFor', () => {
  it('stays quiet below 80%', () => {
    expect(pendingAlertsFor(budget({ spent_paise: 799999 }))).toEqual([]);
  });

  it('fires at exactly 80%', () => {
    expect(pendingAlertsFor(budget({ spent_paise: 800000 }))).toEqual([80]);
  });

  it('fires at exactly 100%', () => {
    expect(pendingAlertsFor(budget({ spent_paise: LIMIT }))).toEqual([100]);
  });

  it('fires once past the limit', () => {
    expect(pendingAlertsFor(budget({ spent_paise: 1400000 }))).toEqual([100]);
  });

  it('never repeats an alert already sent - the point of the flags', () => {
    expect(pendingAlertsFor(budget({ spent_paise: 850000, alert_80_sent: 1 }))).toEqual([]);
    expect(pendingAlertsFor(budget({ spent_paise: 1400000, alert_100_sent: 1 }))).toEqual([]);
  });

  it('does not buzz on every purchase once 80% is announced', () => {
    const announced = budget({ spent_paise: 810000, alert_80_sent: 1 });
    // Several more small purchases, still in the amber band.
    for (const spent of [820000, 850000, 900000, 990000]) {
      expect(pendingAlertsFor({ ...announced, spent_paise: spent })).toEqual([]);
    }
  });

  it('announces only 100 when a budget jumps straight past both bands', () => {
    // One large purchase takes it from 10% to 130%: being told "you are at
    // 80%" as well would be noise.
    expect(pendingAlertsFor(budget({ spent_paise: 1300000 }))).toEqual([100]);
  });

  it('still announces 100 after 80 was already sent', () => {
    expect(pendingAlertsFor(budget({ spent_paise: LIMIT, alert_80_sent: 1 }))).toEqual([100]);
  });

  it('says nothing about a budget with no limit', () => {
    expect(pendingAlertsFor(budget({ limit_paise: 0, spent_paise: 500000 }))).toEqual([]);
  });

  it('treats missing flags as not yet sent', () => {
    const withoutFlags = {
      id: 'b',
      category_id: 'c',
      limit_paise: LIMIT,
      spent_paise: 900000,
    };
    expect(pendingAlertsFor(withoutFlags)).toEqual([80]);
  });
});

describe('collectAlerts', () => {
  it('gathers what every budget owes', () => {
    const alerts = collectAlerts([
      budget({ id: 'a', spent_paise: 850000 }),
      budget({ id: 'b', category_id: 'cat-rent', spent_paise: 1200000 }),
      budget({ id: 'c', category_id: 'cat-fuel', spent_paise: 100000 }),
    ]);

    expect(alerts.map((alert) => [alert.budgetId, alert.threshold])).toEqual([
      ['a', 80],
      ['b', 100],
    ]);
  });

  it('carries the numbers the copy needs', () => {
    const [alert] = collectAlerts([budget({ spent_paise: 850000 })]);

    expect(alert).toMatchObject({
      categoryId: 'cat-food',
      spentPaise: 850000,
      limitPaise: LIMIT,
      usedPercentage: 85,
    });
  });

  it('is empty when nothing has crossed a threshold', () => {
    expect(collectAlerts([budget({ spent_paise: 100000 })])).toEqual([]);
  });

  it('is empty for no budgets', () => {
    expect(collectAlerts([])).toEqual([]);
  });
});

describe('flagsForDeliveredAlert', () => {
  it('marks 80 as sent', () => {
    expect(flagsForDeliveredAlert(80)).toEqual({ alert_80_sent: 1 });
  });

  it('marks both when 100 is delivered, so the 80 warning cannot arrive late', () => {
    expect(flagsForDeliveredAlert(100)).toEqual({ alert_80_sent: 1, alert_100_sent: 1 });
  });
});

describe('alertCopy', () => {
  const eighty: BudgetAlert = {
    budgetId: 'b',
    categoryId: 'c',
    threshold: 80,
    spentPaise: 850000,
    limitPaise: LIMIT,
    usedPercentage: 85,
  };

  it('says how much is left at 80%', () => {
    const copy = alertCopy(eighty, 'Food', (paise) => formatINR(paise, { withDecimals: false }));

    expect(copy.title).toContain('85%');
    expect(copy.body).toContain('₹1,500');
    expect(copy.body).toContain('Food');
  });

  it('says the budget is used up at 100%', () => {
    const copy = alertCopy(
      { ...eighty, threshold: 100, spentPaise: LIMIT, usedPercentage: 100 },
      'Food',
      (paise) => formatINR(paise, { withDecimals: false }),
    );

    expect(copy.title).toContain('used up');
    expect(copy.body).toContain('₹10,000');
  });

  it('states the fact without scolding', () => {
    const copy = alertCopy(eighty, 'Food', formatINR);
    const scolding = /careful|warning!|stop|too much|overspend/i;

    expect(copy.title).not.toMatch(scolding);
    expect(copy.body).not.toMatch(scolding);
  });
});

describe('shouldResetFlags', () => {
  it('allows a fresh warning when the limit is raised', () => {
    expect(shouldResetFlags(1000000, 1500000)).toBe(true);
  });

  it('keeps the flags when the limit is lowered or unchanged', () => {
    expect(shouldResetFlags(1000000, 800000)).toBe(false);
    expect(shouldResetFlags(1000000, 1000000)).toBe(false);
  });
});
