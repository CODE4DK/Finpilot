import { useQuery } from '@powersync/react-native';
import { useMemo, useState } from 'react';

import { useAccounts, useCategories, useTransactionsRepository } from '@/db/hooks';
import type { TransactionFilters, TransactionRow } from '@/db/repositories/transactions';
import { groupByDay, toListItems, type ListItem } from '@/features/ledger/grouping';
import type { TransactionRowData } from '@/components/transaction-row';

/**
 * A display row that also carries the few raw columns the day grouping needs
 * for its totals - the account ids and the soft-delete marker.
 */
export interface TransactionListRow extends TransactionRowData {
  account_id: string;
  to_account_id: string | null;
  deleted_at: string | null;
}

/**
 * The transactions screen's data: filters in, a flat list of day headers and
 * rows out, with the account and category names already joined on so the row
 * component does no lookups while scrolling.
 */
export function useTransactionList(filters: TransactionFilters = {}) {
  const repository = useTransactionsRepository();
  const accounts = useAccounts();
  const categories = useCategories();

  const key = JSON.stringify(filters);
  const query = useMemo(
    () => (repository ? repository.listQuery(JSON.parse(key)) : null),
    [repository, key],
  );

  const { data, isLoading } = useQuery<TransactionRow>(
    query?.sql ?? 'SELECT 1 WHERE 0',
    query?.parameters ?? [],
  );

  const accountNames = useMemo(
    () => new Map(accounts.data.map((account) => [account.id, account.name])),
    [accounts.data],
  );

  const categoryLookup = useMemo(
    () => new Map(categories.data.map((category) => [category.id, category])),
    [categories.data],
  );

  const rows = useMemo<TransactionListRow[]>(
    () =>
      data.map((row) => {
        const category = row.category_id ? categoryLookup.get(row.category_id) : null;
        return {
          id: row.id,
          type: row.type,
          amount_paise: row.amount_paise,
          note: row.note,
          occurred_at: row.occurred_at,
          categoryName: category?.name ?? null,
          categoryIcon: category?.icon ?? null,
          categoryColor: category?.color ?? null,
          accountName: accountNames.get(row.account_id) ?? null,
          toAccountName: row.to_account_id ? (accountNames.get(row.to_account_id) ?? null) : null,
          account_id: row.account_id,
          to_account_id: row.to_account_id,
          deleted_at: row.deleted_at,
        };
      }),
    [accountNames, categoryLookup, data],
  );

  const items = useMemo<ListItem<TransactionListRow>[]>(
    () => toListItems(groupByDay(rows)),
    [rows],
  );

  return { items, rows, raw: data, isLoading };
}

export interface ActiveFilters extends TransactionFilters {
  /** Label for the filter chip row, so the screen can show what is applied. */
  label?: string;
}

/** Filter state for the list screen, kept out of the component. */
export function useTransactionFilters() {
  const [filters, setFilters] = useState<TransactionFilters>({});

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.from || filters.to) count += 1;
    if (filters.types?.length) count += 1;
    if (filters.accountIds?.length) count += 1;
    if (filters.categoryIds?.length) count += 1;
    return count;
  }, [filters]);

  return {
    filters,
    setFilters,
    activeCount,
    clear: () => setFilters({}),
    setSearch: (search: string) =>
      setFilters((current) => ({ ...current, search: search.trim() || undefined })),
  };
}
