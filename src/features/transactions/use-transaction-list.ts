import { useQuery } from '@powersync/react-native';
import { useCallback, useMemo, useState } from 'react';

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
 * How many rows the list holds before the user scrolls.
 *
 * Without a ceiling the screen pulls every transaction a user has ever made
 * into JavaScript, maps it, groups it by day and hands the result to
 * FlashList - on every keystroke in the search box. At ten thousand rows that
 * is seconds of work for a screen that shows twenty. The page is large enough
 * that the first screenful is never short, and `loadMore` grows it as the user
 * actually scrolls.
 */
export const PAGE_SIZE = 200;

/**
 * The transactions screen's data: filters in, a flat list of day headers and
 * rows out, with the account and category names already joined on so the row
 * component does no lookups while scrolling.
 *
 * Paginated unless the caller passes its own `limit`.
 */
export function useTransactionList(filters: TransactionFilters = {}) {
  const repository = useTransactionsRepository();
  const accounts = useAccounts();
  const categories = useCategories();

  const key = JSON.stringify(filters);
  const [pagination, setPagination] = useState({ key, pages: 1 });

  // A new filter or search term is a new list: start it at one page again, or
  // a user who scrolled far keeps paying for rows they filtered away. Reset
  // during render rather than in an effect - an effect would render once with
  // the old page count and immediately again with the new one.
  const pages = pagination.key === key ? pagination.pages : 1;
  if (pagination.key !== key) {
    setPagination({ key, pages: 1 });
  }

  const limit = filters.limit ?? PAGE_SIZE * pages;

  const query = useMemo(
    () =>
      repository
        ? repository.listQuery({ ...(JSON.parse(key) as TransactionFilters), limit })
        : null,
    [repository, key, limit],
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

  /** True while the database still has rows beyond the ones loaded. */
  const hasMore = filters.limit === undefined && data.length >= limit;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setPagination((current) => ({ key, pages: current.key === key ? current.pages + 1 : 2 }));
    }
  }, [hasMore, key]);

  return { items, rows, raw: data, isLoading, hasMore, loadMore, loaded: data.length };
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
