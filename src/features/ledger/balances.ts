import { addPaise, subtractPaise } from '@/utils/money';

/**
 * Balance arithmetic.
 *
 * The rule, in one line: an account's balance is its opening balance, plus
 * income into it, minus expenses out of it, minus transfers leaving it, plus
 * transfers arriving in it.
 *
 * A transfer therefore touches **two** accounts and nets to zero across them -
 * which is why net worth is not simply "sum of all transaction amounts".
 */

export interface BalanceAccount {
  id: string;
  opening_balance_paise: number;
  is_archived?: number | boolean;
}

export interface BalanceTransaction {
  type: string;
  amount_paise: number;
  account_id: string;
  to_account_id?: string | null;
  /** Soft-deleted rows must not count. */
  deleted_at?: string | null;
}

/** How one transaction moves one account's balance. */
export function movementFor(transaction: BalanceTransaction, accountId: string): number {
  if (transaction.deleted_at) {
    return 0;
  }

  const { type, amount_paise: amount, account_id, to_account_id } = transaction;

  if (type === 'transfer') {
    // A transfer to and from the same account is not a real movement; the
    // database rejects it, but a corrupt row should not silently double-count.
    if (account_id === to_account_id) {
      return 0;
    }
    if (account_id === accountId) {
      return -amount;
    }
    if (to_account_id === accountId) {
      return amount;
    }
    return 0;
  }

  if (account_id !== accountId) {
    return 0;
  }

  return type === 'income' ? amount : -amount;
}

export function accountBalance(
  account: BalanceAccount,
  transactions: readonly BalanceTransaction[],
): number {
  return transactions.reduce(
    (balance, transaction) => addPaise(balance, movementFor(transaction, account.id)),
    account.opening_balance_paise,
  );
}

export interface AccountBalance {
  accountId: string;
  balancePaise: number;
}

export function accountBalances(
  accounts: readonly BalanceAccount[],
  transactions: readonly BalanceTransaction[],
): AccountBalance[] {
  return accounts.map((account) => ({
    accountId: account.id,
    balancePaise: accountBalance(account, transactions),
  }));
}

export interface NetWorth {
  totalPaise: number;
  /** Positive balances - what you hold. */
  assetsPaise: number;
  /** Negative balances as a positive number - what you owe. */
  liabilitiesPaise: number;
}

/**
 * Net worth across accounts. Archived accounts are included by default: money
 * in a closed-but-not-empty account is still yours.
 */
export function netWorth(
  accounts: readonly BalanceAccount[],
  transactions: readonly BalanceTransaction[] = [],
  options: { includeArchived?: boolean } = {},
): NetWorth {
  const { includeArchived = true } = options;

  const included = includeArchived ? accounts : accounts.filter((account) => !account.is_archived);

  return included.reduce<NetWorth>(
    (totals, account) => {
      const balance = accountBalance(account, transactions);
      return {
        totalPaise: addPaise(totals.totalPaise, balance),
        assetsPaise: balance > 0 ? addPaise(totals.assetsPaise, balance) : totals.assetsPaise,
        liabilitiesPaise:
          balance < 0 ? subtractPaise(totals.liabilitiesPaise, balance) : totals.liabilitiesPaise,
      };
    },
    { totalPaise: 0, assetsPaise: 0, liabilitiesPaise: 0 },
  );
}

export interface PeriodTotals {
  incomePaise: number;
  expensePaise: number;
  /** income - expense. Transfers are excluded: they move money, not make it. */
  netPaise: number;
}

/**
 * Income and expense over a set of transactions. Transfers are deliberately
 * excluded - counting them would make moving ₹1000 between your own accounts
 * look like ₹1000 of income and ₹1000 of spending.
 */
export function periodTotals(transactions: readonly BalanceTransaction[]): PeriodTotals {
  let incomePaise = 0;
  let expensePaise = 0;

  for (const transaction of transactions) {
    if (transaction.deleted_at) {
      continue;
    }
    if (transaction.type === 'income') {
      incomePaise = addPaise(incomePaise, transaction.amount_paise);
    } else if (transaction.type === 'expense') {
      expensePaise = addPaise(expensePaise, transaction.amount_paise);
    }
  }

  return { incomePaise, expensePaise, netPaise: subtractPaise(incomePaise, expensePaise) };
}
