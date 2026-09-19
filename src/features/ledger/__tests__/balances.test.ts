import {
  accountBalance,
  accountBalances,
  movementFor,
  netWorth,
  periodTotals,
  type BalanceTransaction,
} from '@/features/ledger/balances';

const CASH = { id: 'cash', opening_balance_paise: 500000 };
const BANK = { id: 'bank', opening_balance_paise: 10000000 };
const CARD = { id: 'card', opening_balance_paise: -2500000, is_archived: 0 };

function expense(amount: number, accountId = 'cash'): BalanceTransaction {
  return { type: 'expense', amount_paise: amount, account_id: accountId };
}
function income(amount: number, accountId = 'bank'): BalanceTransaction {
  return { type: 'income', amount_paise: amount, account_id: accountId };
}
function transfer(amount: number, from: string, to: string): BalanceTransaction {
  return { type: 'transfer', amount_paise: amount, account_id: from, to_account_id: to };
}

describe('movementFor', () => {
  it('adds income to the account it landed in', () => {
    expect(movementFor(income(100000, 'bank'), 'bank')).toBe(100000);
  });

  it('subtracts an expense from the account it came out of', () => {
    expect(movementFor(expense(25000, 'cash'), 'cash')).toBe(-25000);
  });

  it('ignores a transaction on another account', () => {
    expect(movementFor(expense(25000, 'cash'), 'bank')).toBe(0);
    expect(movementFor(income(25000, 'bank'), 'cash')).toBe(0);
  });

  it('takes a transfer out of the source and into the destination', () => {
    const move = transfer(500000, 'bank', 'cash');
    expect(movementFor(move, 'bank')).toBe(-500000);
    expect(movementFor(move, 'cash')).toBe(500000);
  });

  it('nets a transfer to zero across the two accounts', () => {
    const move = transfer(500000, 'bank', 'cash');
    expect(movementFor(move, 'bank') + movementFor(move, 'cash')).toBe(0);
  });

  it('ignores a transfer touching neither account', () => {
    expect(movementFor(transfer(100, 'bank', 'cash'), 'card')).toBe(0);
  });

  it('counts a soft-deleted transaction as nothing', () => {
    expect(
      movementFor({ ...expense(25000, 'cash'), deleted_at: '2026-09-19T00:00:00.000Z' }, 'cash'),
    ).toBe(0);
    expect(
      movementFor(
        { ...transfer(500000, 'bank', 'cash'), deleted_at: '2026-09-19T00:00:00.000Z' },
        'cash',
      ),
    ).toBe(0);
  });

  it('refuses to double-count a corrupt self-transfer', () => {
    const selfTransfer = transfer(100000, 'cash', 'cash');
    expect(movementFor(selfTransfer, 'cash')).toBe(0);
  });
});

describe('accountBalance', () => {
  it('is the opening balance when there are no transactions', () => {
    expect(accountBalance(CASH, [])).toBe(500000);
  });

  it('applies income and expense', () => {
    expect(accountBalance(BANK, [income(8500000, 'bank'), expense(120000, 'bank')])).toBe(
      10000000 + 8500000 - 120000,
    );
  });

  it('applies both sides of a transfer', () => {
    const transactions = [transfer(500000, 'bank', 'cash')];
    expect(accountBalance(BANK, transactions)).toBe(10000000 - 500000);
    expect(accountBalance(CASH, transactions)).toBe(500000 + 500000);
  });

  it('can go negative', () => {
    expect(accountBalance(CASH, [expense(900000, 'cash')])).toBe(500000 - 900000);
  });

  it('starts negative for a credit card and grows more negative with spending', () => {
    expect(accountBalance(CARD, [expense(100000, 'card')])).toBe(-2600000);
  });

  it('excludes soft-deleted transactions', () => {
    const transactions = [
      expense(100000, 'cash'),
      { ...expense(999999, 'cash'), deleted_at: '2026-09-19T00:00:00.000Z' },
    ];
    expect(accountBalance(CASH, transactions)).toBe(400000);
  });

  it('stays an integer number of paise', () => {
    const balance = accountBalance(CASH, [expense(33333, 'cash'), income(11111, 'cash')]);
    expect(Number.isInteger(balance)).toBe(true);
  });
});

describe('accountBalances', () => {
  it('computes every account in one pass', () => {
    const transactions = [transfer(500000, 'bank', 'cash'), expense(120000, 'cash')];

    expect(accountBalances([CASH, BANK], transactions)).toEqual([
      { accountId: 'cash', balancePaise: 500000 + 500000 - 120000 },
      { accountId: 'bank', balancePaise: 10000000 - 500000 },
    ]);
  });
});

describe('netWorth', () => {
  it('sums balances across accounts', () => {
    expect(netWorth([CASH, BANK], []).totalPaise).toBe(10500000);
  });

  it('separates what you hold from what you owe', () => {
    const result = netWorth([CASH, BANK, CARD], []);

    expect(result.assetsPaise).toBe(10500000);
    expect(result.liabilitiesPaise).toBe(2500000);
    expect(result.totalPaise).toBe(10500000 - 2500000);
  });

  it('is unchanged by a transfer between your own accounts', () => {
    const before = netWorth([CASH, BANK], []);
    const after = netWorth([CASH, BANK], [transfer(500000, 'bank', 'cash')]);

    expect(after.totalPaise).toBe(before.totalPaise);
  });

  it('includes archived accounts by default - the money is still yours', () => {
    const archived = { id: 'old', opening_balance_paise: 100000, is_archived: 1 };
    expect(netWorth([CASH, archived]).totalPaise).toBe(600000);
    expect(netWorth([CASH, archived], [], { includeArchived: false }).totalPaise).toBe(500000);
  });

  it('is zero with no accounts', () => {
    expect(netWorth([], [])).toEqual({ totalPaise: 0, assetsPaise: 0, liabilitiesPaise: 0 });
  });
});

describe('periodTotals', () => {
  it('sums income and expense separately', () => {
    expect(periodTotals([income(8500000, 'bank'), expense(120000, 'cash')])).toEqual({
      incomePaise: 8500000,
      expensePaise: 120000,
      netPaise: 8380000,
    });
  });

  it('excludes transfers - moving money is not earning or spending it', () => {
    expect(periodTotals([transfer(500000, 'bank', 'cash')])).toEqual({
      incomePaise: 0,
      expensePaise: 0,
      netPaise: 0,
    });
  });

  it('excludes soft-deleted rows', () => {
    expect(
      periodTotals([
        expense(100000, 'cash'),
        { ...expense(999999, 'cash'), deleted_at: '2026-09-19T00:00:00.000Z' },
      ]).expensePaise,
    ).toBe(100000);
  });

  it('can report a negative net', () => {
    expect(periodTotals([income(100000), expense(250000)]).netPaise).toBe(-150000);
  });

  it('is zero for an empty period', () => {
    expect(periodTotals([])).toEqual({ incomePaise: 0, expensePaise: 0, netPaise: 0 });
  });
});
