import {
  groupByDay,
  listItemKey,
  toListItems,
  type DayGroupTransaction,
} from '@/features/ledger/grouping';

const NOW = new Date(2026, 8, 19, 18, 0);

function transaction(
  id: string,
  occurredAt: Date,
  overrides: Partial<DayGroupTransaction> = {},
): DayGroupTransaction {
  return {
    id,
    type: 'expense',
    amount_paise: 100000,
    account_id: 'acc-1',
    occurred_at: occurredAt.toISOString(),
    created_at: occurredAt.toISOString(),
    ...overrides,
  };
}

describe('groupByDay', () => {
  it('groups transactions into local days', () => {
    const groups = groupByDay(
      [
        transaction('a', new Date(2026, 8, 19, 9, 0)),
        transaction('b', new Date(2026, 8, 19, 18, 0)),
        transaction('c', new Date(2026, 8, 18, 12, 0)),
      ],
      NOW,
    );

    expect(groups.map((group) => group.dayKey)).toEqual(['2026-09-19', '2026-09-18']);
    expect(groups[0]!.transactions).toHaveLength(2);
  });

  it('puts the newest day first', () => {
    const groups = groupByDay(
      [
        transaction('old', new Date(2026, 8, 1, 12, 0)),
        transaction('new', new Date(2026, 8, 19, 12, 0)),
      ],
      NOW,
    );

    expect(groups[0]!.dayKey).toBe('2026-09-19');
  });

  it('puts the newest transaction first within a day', () => {
    const groups = groupByDay(
      [
        transaction('morning', new Date(2026, 8, 19, 9, 0)),
        transaction('evening', new Date(2026, 8, 19, 21, 0)),
      ],
      NOW,
    );

    expect(groups[0]!.transactions.map((t) => t.id)).toEqual(['evening', 'morning']);
  });

  it('breaks a tie on the same instant by insertion order', () => {
    const sameInstant = new Date(2026, 8, 19, 12, 0);
    const groups = groupByDay(
      [
        transaction('first', sameInstant, { created_at: '2026-09-19T06:00:00.000Z' }),
        transaction('second', sameInstant, { created_at: '2026-09-19T07:00:00.000Z' }),
      ],
      NOW,
    );

    expect(groups[0]!.transactions.map((t) => t.id)).toEqual(['second', 'first']);
  });

  it('totals each day separately', () => {
    const groups = groupByDay(
      [
        transaction('a', new Date(2026, 8, 19, 9, 0), { amount_paise: 100000 }),
        transaction('b', new Date(2026, 8, 19, 10, 0), { type: 'income', amount_paise: 500000 }),
        transaction('c', new Date(2026, 8, 18, 10, 0), { amount_paise: 25000 }),
      ],
      NOW,
    );

    expect(groups[0]!.totals).toEqual({
      incomePaise: 500000,
      expensePaise: 100000,
      netPaise: 400000,
    });
    expect(groups[1]!.totals.expensePaise).toBe(25000);
  });

  it('excludes transfers from the daily total but still lists them', () => {
    const groups = groupByDay(
      [
        transaction('t', new Date(2026, 8, 19, 9, 0), {
          type: 'transfer',
          to_account_id: 'acc-2',
          amount_paise: 500000,
        }),
      ],
      NOW,
    );

    expect(groups[0]!.transactions).toHaveLength(1);
    expect(groups[0]!.totals).toEqual({ incomePaise: 0, expensePaise: 0, netPaise: 0 });
  });

  it('drops soft-deleted transactions entirely', () => {
    const groups = groupByDay(
      [
        transaction('live', new Date(2026, 8, 19, 9, 0)),
        transaction('gone', new Date(2026, 8, 19, 10, 0), { deleted_at: '2026-09-19' }),
      ],
      NOW,
    );

    expect(groups[0]!.transactions.map((t) => t.id)).toEqual(['live']);
  });

  it('omits a day that has only deleted transactions', () => {
    const groups = groupByDay(
      [transaction('gone', new Date(2026, 8, 18, 10, 0), { deleted_at: '2026-09-19' })],
      NOW,
    );

    expect(groups).toEqual([]);
  });

  it('labels today and yesterday', () => {
    const groups = groupByDay(
      [
        transaction('a', new Date(2026, 8, 19, 9, 0)),
        transaction('b', new Date(2026, 8, 18, 9, 0)),
        transaction('c', new Date(2026, 8, 10, 9, 0)),
      ],
      NOW,
    );

    expect(groups.map((group) => group.heading).slice(0, 2)).toEqual(['Today', 'Yesterday']);
    expect(groups[2]!.heading).toContain('Sep');
  });

  it('handles an empty list', () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });

  it('groups across a month boundary', () => {
    const groups = groupByDay(
      [
        transaction('a', new Date(2026, 8, 1, 9, 0)),
        transaction('b', new Date(2026, 7, 31, 23, 0)),
      ],
      NOW,
    );

    expect(groups.map((group) => group.dayKey)).toEqual(['2026-09-01', '2026-08-31']);
  });
});

describe('toListItems', () => {
  it('flattens groups into headers followed by rows', () => {
    const groups = groupByDay(
      [
        transaction('a', new Date(2026, 8, 19, 9, 0)),
        transaction('b', new Date(2026, 8, 18, 9, 0)),
      ],
      NOW,
    );

    expect(toListItems(groups).map((item) => item.kind)).toEqual([
      'header',
      'transaction',
      'header',
      'transaction',
    ]);
  });

  it('carries the totals on the header', () => {
    const groups = groupByDay([transaction('a', new Date(2026, 8, 19, 9, 0))], NOW);
    const [header] = toListItems(groups);

    expect(header).toMatchObject({ kind: 'header', heading: 'Today' });
  });

  it('gives every item a stable, unique key', () => {
    const groups = groupByDay(
      [
        transaction('a', new Date(2026, 8, 19, 9, 0)),
        transaction('b', new Date(2026, 8, 19, 10, 0)),
        transaction('c', new Date(2026, 8, 18, 10, 0)),
      ],
      NOW,
    );
    const keys = toListItems(groups).map(listItemKey);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is empty for no groups', () => {
    expect(toListItems([])).toEqual([]);
  });
});
