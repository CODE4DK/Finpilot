import { useQuery, useStatus } from '@powersync/react-native';
import { useMemo } from 'react';

import { useAuthStore } from '@/features/auth/auth-store';

import { getPowerSync } from './powersync';
import { AccountsRepository, type AccountRow } from './repositories/accounts';
import { BudgetsRepository, toMonthKey, type BudgetRow } from './repositories/budgets';
import { CategoriesRepository, type CategoryRow } from './repositories/categories';
import {
  GoalContributionsRepository,
  GoalsRepository,
  type GoalContributionRow,
  type GoalRow,
} from './repositories/goals';
import { InsightsRepository, type InsightRow } from './repositories/insights';
import { ProfilesRepository, type ProfileRow } from './repositories/profiles';
import { RecurringRulesRepository, type RecurringRuleRow } from './repositories/recurring-rules';
import {
  TransactionsRepository,
  type TransactionFilters,
  type TransactionRow,
} from './repositories/transactions';
import type { RepositoryContext } from './repositories/types';
import { summariseSyncStatus, type SyncSummary } from './sync-status';

/**
 * Reactive reads.
 *
 * Every hook hands PowerSync's `useQuery` the SQL a repository builds, so the
 * query lives in one place and the hook re-renders whenever the underlying
 * rows change - locally or from a sync.
 */

function useRepositoryContext(): RepositoryContext | null {
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useMemo(() => {
    if (!userId) {
      return null;
    }
    return { db: getPowerSync() as never, userId };
  }, [userId]);
}

/** A query that returns nothing while signed out, rather than throwing. */
const NO_ROWS = { sql: 'SELECT 1 WHERE 0', parameters: [] as unknown[] };

export interface QueryResult<T> {
  data: T[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | undefined;
}

export function useAccounts(): QueryResult<AccountRow> {
  const context = useRepositoryContext();
  const { sql, parameters } = context ? new AccountsRepository(context).listQuery() : NO_ROWS;
  return useQuery<AccountRow>(sql, parameters);
}

export function useActiveAccounts(): QueryResult<AccountRow> {
  const all = useAccounts();
  return useMemo(
    () => ({ ...all, data: all.data.filter((account) => account.is_archived === 0) }),
    [all],
  );
}

export function useCategories(type?: 'income' | 'expense'): QueryResult<CategoryRow> {
  const context = useRepositoryContext();
  const { sql, parameters } = context ? new CategoriesRepository(context).listQuery(type) : NO_ROWS;
  return useQuery<CategoryRow>(sql, parameters);
}

export function useTransactions(filters: TransactionFilters = {}): QueryResult<TransactionRow> {
  const context = useRepositoryContext();
  // Filters are usually an inline object literal, so memoise on their content
  // rather than their identity or the query restarts on every render.
  const key = JSON.stringify(filters);
  const { sql, parameters } = useMemo(
    () => (context ? new TransactionsRepository(context).listQuery(JSON.parse(key)) : NO_ROWS),
    [context, key],
  );
  return useQuery<TransactionRow>(sql, parameters);
}

export function useTransactionTotals(
  from: string,
  to: string,
): QueryResult<{ income_paise: number; expense_paise: number }> {
  const context = useRepositoryContext();
  const { sql, parameters } = context
    ? new TransactionsRepository(context).totalsQuery(from, to)
    : NO_ROWS;
  return useQuery(sql, parameters);
}

export function useSpendByCategory(
  from: string,
  to: string,
): QueryResult<{ category_id: string | null; spent_paise: number }> {
  const context = useRepositoryContext();
  const { sql, parameters } = context
    ? new TransactionsRepository(context).spendByCategoryQuery(from, to)
    : NO_ROWS;
  return useQuery(sql, parameters);
}

export function useBudgets(month: string = toMonthKey(new Date())): QueryResult<BudgetRow> {
  const context = useRepositoryContext();
  const { sql, parameters } = context ? new BudgetsRepository(context).listQuery(month) : NO_ROWS;
  return useQuery<BudgetRow>(sql, parameters);
}

export function useBudgetProgress(
  month: string = toMonthKey(new Date()),
): QueryResult<BudgetRow & { spent_paise: number }> {
  const context = useRepositoryContext();
  const { sql, parameters } = context
    ? new BudgetsRepository(context).progressQuery(month)
    : NO_ROWS;
  return useQuery(sql, parameters);
}

export function useGoals(
  status?: 'active' | 'completed' | 'archived',
): QueryResult<GoalRow & { saved_paise: number }> {
  const context = useRepositoryContext();
  const { sql, parameters } = context ? new GoalsRepository(context).listQuery(status) : NO_ROWS;
  return useQuery(sql, parameters);
}

export function useGoalContributions(goalId: string): QueryResult<GoalContributionRow> {
  const context = useRepositoryContext();
  const { sql, parameters } = context
    ? new GoalContributionsRepository(context).listQuery(goalId)
    : NO_ROWS;
  return useQuery<GoalContributionRow>(sql, parameters);
}

export function useRecurringRules(): QueryResult<RecurringRuleRow> {
  const context = useRepositoryContext();
  const { sql, parameters } = context ? new RecurringRulesRepository(context).listQuery() : NO_ROWS;
  return useQuery<RecurringRuleRow>(sql, parameters);
}

export function useInsights(): QueryResult<InsightRow> {
  const context = useRepositoryContext();
  const { sql, parameters } = context ? new InsightsRepository(context).listQuery() : NO_ROWS;
  return useQuery<InsightRow>(sql, parameters);
}

export function useProfile(): ProfileRow | null {
  const context = useRepositoryContext();
  const { sql, parameters } = context ? new ProfilesRepository(context).currentQuery() : NO_ROWS;
  const { data } = useQuery<ProfileRow>(sql, parameters);
  return data[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Writes. Repositories are cheap to construct, so hooks hand back a
 * fresh one bound to the current user rather than a memoised singleton.
 * ------------------------------------------------------------------ */

function useRepository<T>(factory: (context: RepositoryContext) => T): T | null {
  const context = useRepositoryContext();
  return useMemo(() => (context ? factory(context) : null), [context, factory]);
}

export function useAccountsRepository(): AccountsRepository | null {
  return useRepository((context) => new AccountsRepository(context));
}

export function useCategoriesRepository(): CategoriesRepository | null {
  return useRepository((context) => new CategoriesRepository(context));
}

export function useTransactionsRepository(): TransactionsRepository | null {
  return useRepository((context) => new TransactionsRepository(context));
}

export function useBudgetsRepository(): BudgetsRepository | null {
  return useRepository((context) => new BudgetsRepository(context));
}

export function useBudgetProgressForMonth(month: string) {
  return useBudgetProgress(month);
}

export function useGoalsRepository(): GoalsRepository | null {
  return useRepository((context) => new GoalsRepository(context));
}

export function useGoalContributionsRepository(): GoalContributionsRepository | null {
  return useRepository((context) => new GoalContributionsRepository(context));
}

export function useRecurringRulesRepository(): RecurringRulesRepository | null {
  return useRepository((context) => new RecurringRulesRepository(context));
}

/** The sync indicator's data source. */
export function useSyncSummary(): SyncSummary {
  const status = useStatus();
  return useMemo(() => summariseSyncStatus(status as never), [status]);
}
