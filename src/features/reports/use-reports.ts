/**
 * Reactive report data.
 *
 * Each query is a watched query over the local database, so the whole screen
 * updates the moment a transaction is added, edited or arrives from a sync -
 * including while offline, because nothing here asks the network anything.
 */

import { useQuery } from '@powersync/react-native';
import { useCallback, useMemo, useState } from 'react';

import { getPowerSync } from '@/db/powersync';
import { useCategories } from '@/db/hooks';
import type { PowerSyncDatabaseLike } from '@/db/repositories/types';
import { useAuthStore } from '@/features/auth/auth-store';
import { useTheme } from '@/theme';
import { subtractPaise } from '@/utils/money';

import {
  buildCategoryChanges,
  buildCategorySlices,
  buildTopExpenses,
  buildTrend,
  dailyAveragePaise,
  type CategoryChange,
  type CategorySlice,
  type TopExpense,
  type TrendPoint,
} from './aggregate';
import { exportPeriodCsv, type CsvExportResult } from './export-csv';
import {
  categoryChangeQuery,
  categorySpendQuery,
  monthlyTotalsQuery,
  periodTotalsQuery,
  topExpensesQuery,
  type CategoryChangeRow,
  type CategorySpendRow,
  type MonthlyTotalsRow,
  type PeriodTotalsRow,
  type TopExpenseRow,
} from './queries';
import {
  elapsedDays,
  monthBuckets,
  precedingPeriod,
  resolveReportPeriod,
  type CustomRange,
  type ReportPeriod,
  type ReportPreset,
} from './periods';

/** Returns nothing rather than throwing while signed out. */
const NO_ROWS = { sql: 'SELECT 1 WHERE 0', parameters: [] as unknown[] };

function useUserId(): string | null {
  return useAuthStore((state) => state.user?.id ?? null);
}

export interface ReportData {
  period: ReportPeriod;
  incomePaise: number;
  expensePaise: number;
  netPaise: number;
  slices: CategorySlice[];
  trend: TrendPoint[];
  changes: CategoryChange[];
  topExpenses: TopExpense[];
  dailyAveragePaise: number;
  days: number;
  isLoading: boolean;
}

export function useReportData(period: ReportPeriod, now: Date = new Date()): ReportData {
  const userId = useUserId();
  const scheme = useTheme().scheme;
  const categories = useCategories();

  // Key on the boundaries rather than the object: the period is rebuilt on
  // every render, but its bounds only move when the user picks a new one.
  const { from, to } = period;
  const buckets = useMemo(() => monthBuckets({ from, to }), [from, to]);
  const previous = useMemo(() => precedingPeriod({ from, to }), [from, to]);

  const totalsQuery = userId ? periodTotalsQuery(userId, period) : NO_ROWS;
  const spendQuery = userId ? categorySpendQuery(userId, period) : NO_ROWS;
  const trendQuery = userId ? monthlyTotalsQuery(userId, buckets) : NO_ROWS;
  const changeQuery = userId ? categoryChangeQuery(userId, period, previous) : NO_ROWS;
  const topQuery = userId ? topExpensesQuery(userId, period) : NO_ROWS;

  const totals = useQuery<PeriodTotalsRow>(totalsQuery.sql, totalsQuery.parameters);
  const spend = useQuery<CategorySpendRow>(spendQuery.sql, spendQuery.parameters);
  const trendRows = useQuery<MonthlyTotalsRow>(trendQuery.sql, trendQuery.parameters);
  const changeRows = useQuery<CategoryChangeRow>(changeQuery.sql, changeQuery.parameters);
  const topRows = useQuery<TopExpenseRow>(topQuery.sql, topQuery.parameters);

  const income = totals.data[0]?.income_paise ?? 0;
  const expense = totals.data[0]?.expense_paise ?? 0;
  const days = elapsedDays(period, now);

  return {
    period,
    incomePaise: income,
    expensePaise: expense,
    netPaise: subtractPaise(income, expense),
    slices: useMemo(
      () => buildCategorySlices(spend.data, categories.data, scheme),
      [spend.data, categories.data, scheme],
    ),
    trend: useMemo(() => buildTrend(trendRows.data, buckets), [trendRows.data, buckets]),
    changes: useMemo(
      () => buildCategoryChanges(changeRows.data, categories.data),
      [changeRows.data, categories.data],
    ),
    topExpenses: useMemo(
      () => buildTopExpenses(topRows.data, categories.data),
      [topRows.data, categories.data],
    ),
    dailyAveragePaise: dailyAveragePaise(expense, days),
    days,
    isLoading: totals.isLoading || spend.isLoading,
  };
}

/** The period selector's state, including the custom range. */
export function useReportPeriod(initial: ReportPreset = 'this-month', now: Date = new Date()) {
  const [preset, setPreset] = useState<ReportPreset>(initial);
  const [custom, setCustom] = useState<CustomRange | null>(null);

  // `now` is a fresh Date on every render, so key on the day it falls in -
  // the period only has to be rebuilt when the date changes under the app.
  const today = now.toDateString();
  const period = useMemo(
    () => resolveReportPeriod(preset, new Date(today), custom ?? undefined),
    [preset, custom, today],
  );

  const selectCustom = useCallback((range: CustomRange) => {
    setCustom(range);
    setPreset('custom');
  }, []);

  return { preset, setPreset, period, custom, selectCustom };
}

export interface CsvExportState {
  isExporting: boolean;
  exportCsv: () => Promise<CsvExportResult>;
}

export function useCsvExport(period: ReportPeriod): CsvExportState {
  const userId = useUserId();
  const [isExporting, setExporting] = useState(false);

  const exportCsv = useCallback(async (): Promise<CsvExportResult> => {
    if (!userId) {
      return { status: 'empty' };
    }
    setExporting(true);
    try {
      return await exportPeriodCsv(getPowerSync() as unknown as PowerSyncDatabaseLike, userId, {
        from: period.from,
        to: period.to,
      });
    } finally {
      setExporting(false);
    }
  }, [userId, period.from, period.to]);

  return { isExporting, exportCsv };
}
