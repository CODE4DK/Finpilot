import { useQuery } from '@powersync/react-native';
import { useMemo } from 'react';

import { useAccountsRepository } from '@/db/hooks';
import type { AccountRow } from '@/db/repositories/accounts';
import { addPaise, subtractPaise } from '@/utils/money';

export interface AccountWithBalance extends AccountRow {
  balance_paise: number;
}

export interface NetWorthSummary {
  totalPaise: number;
  assetsPaise: number;
  liabilitiesPaise: number;
}

/** Sums balances into a net worth summary. Pure, so it is unit tested. */
export function summariseNetWorth(accounts: readonly { balance_paise: number }[]): NetWorthSummary {
  return accounts.reduce<NetWorthSummary>(
    (totals, account) => ({
      totalPaise: addPaise(totals.totalPaise, account.balance_paise),
      assetsPaise:
        account.balance_paise > 0
          ? addPaise(totals.assetsPaise, account.balance_paise)
          : totals.assetsPaise,
      liabilitiesPaise:
        account.balance_paise < 0
          ? subtractPaise(totals.liabilitiesPaise, account.balance_paise)
          : totals.liabilitiesPaise,
    }),
    { totalPaise: 0, assetsPaise: 0, liabilitiesPaise: 0 },
  );
}

/**
 * Accounts with their current balance, computed in SQL so the list does not
 * pull every transaction into JavaScript to add it up.
 *
 * The arithmetic itself is specified and tested in
 * `src/features/ledger/balances.ts`; the query is the same rule in SQL, and
 * `src/features/accounts/__tests__` checks the two agree.
 */
export function useAccountsWithBalances() {
  const repository = useAccountsRepository();
  const query = useMemo(() => repository?.balancesQuery() ?? null, [repository]);

  const { data, isLoading } = useQuery<AccountWithBalance>(
    query?.sql ?? 'SELECT 1 WHERE 0',
    query?.parameters ?? [],
  );

  return {
    accounts: data,
    active: useMemo(() => data.filter((account) => account.is_archived === 0), [data]),
    netWorth: useMemo(() => summariseNetWorth(data), [data]),
    isLoading,
  };
}
