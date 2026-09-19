/**
 * Insights on the device.
 *
 * Three things come together here:
 *
 *   * the **cached** AI insight, which is an ordinary synced row - so the last
 *     result is on screen instantly, offline, and on a second device;
 *   * the **rule-based** insight, computed locally from the same local
 *     database the reports read;
 *   * the **generate** action, which is the only call that leaves the device
 *     and only runs when the user asks for it.
 *
 * What the screen shows is decided by `resolveInsight`: the AI result when
 * there is one for the month, the rules otherwise. That is deliberately not a
 * loading state - there is always something honest to show.
 */

import { useCallback, useMemo, useState } from 'react';

import {
  useBudgetProgress,
  useCategories,
  useGoals,
  useInsights,
  useSyncSummary,
} from '@/db/hooks';
import { getSupabaseClient } from '@/lib/supabase';
import { monthPeriod, shiftMonth, toMonthStartKey } from '@/features/ledger/period';
import {
  categoryChangeQuery,
  categorySpendQuery,
  elapsedDays,
  periodTotalsQuery,
  precedingPeriod,
  resolveReportPeriod,
  type CategoryChangeRow,
  type CategorySpendRow,
  type PeriodTotalsRow,
} from '@/features/reports';
import { useAuthStore } from '@/features/auth/auth-store';
import { useQuery } from '@powersync/react-native';

import { buildRuleBasedInsight, type RuleCategory } from './rule-based';
import { parseInsight, type Insight } from './types';

const NO_ROWS = { sql: 'SELECT 1 WHERE 0', parameters: [] as unknown[] };

/** "2026-09-01" - how the insights table keys a month. */
export function currentMonthKey(now: Date = new Date()): string {
  return toMonthStartKey(now);
}

/** The AI insight stored for a month, or null. */
export function useStoredInsight(month: string = currentMonthKey()): Insight | null {
  const rows = useInsights();
  return useMemo(() => {
    const row = rows.data.find((candidate) => candidate.month === month);
    return row ? parseInsight(row.summary) : null;
  }, [rows.data, month]);
}

/**
 * The on-device insight for a month. Always available - it is arithmetic over
 * rows that are already here.
 */
export function useRuleBasedInsight(month: string = currentMonthKey(), now: Date = new Date()) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const categories = useCategories();
  const budgets = useBudgetProgress(month);
  const goals = useGoals('active');

  const period = useMemo(() => monthPeriod(new Date(`${month}T00:00:00`)), [month]);
  const previous = useMemo(() => precedingPeriod(period), [period]);

  const totalsQuery = userId ? periodTotalsQuery(userId, period) : NO_ROWS;
  const spendQuery = userId ? categorySpendQuery(userId, period) : NO_ROWS;
  const previousQuery = userId ? periodTotalsQuery(userId, previous) : NO_ROWS;
  const changeQuery = userId ? categoryChangeQuery(userId, period, previous) : NO_ROWS;

  const totals = useQuery<PeriodTotalsRow>(totalsQuery.sql, totalsQuery.parameters);
  const spend = useQuery<CategorySpendRow>(spendQuery.sql, spendQuery.parameters);
  const previousTotals = useQuery<PeriodTotalsRow>(previousQuery.sql, previousQuery.parameters);
  const changes = useQuery<CategoryChangeRow>(changeQuery.sql, changeQuery.parameters);

  return useMemo(() => {
    const categoryNames = new Map(categories.data.map((row) => [row.id, row.name]));
    const previousByCategory = new Map(
      changes.data.map((row) => [row.category_id, row.previous_paise]),
    );

    const ruleCategories: RuleCategory[] = spend.data.map((row) => ({
      name: row.category_id
        ? (categoryNames.get(row.category_id) ?? 'Uncategorised')
        : 'Uncategorised',
      spentPaise: row.spent_paise,
      previousPaise: previousByCategory.get(row.category_id) ?? 0,
      txnCount: row.txn_count,
    }));

    const reportPeriod = resolveReportPeriod('this-month', new Date(`${month}T00:00:00`));

    return buildRuleBasedInsight({
      monthLabel: new Date(`${month}T00:00:00`).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      }),
      incomePaise: totals.data[0]?.income_paise ?? 0,
      expensePaise: totals.data[0]?.expense_paise ?? 0,
      previousExpensePaise: previousTotals.data[0]?.expense_paise ?? 0,
      daysElapsed: elapsedDays(reportPeriod, now),
      daysInMonth: new Date(
        new Date(`${month}T00:00:00`).getFullYear(),
        new Date(`${month}T00:00:00`).getMonth() + 1,
        0,
      ).getDate(),
      categories: ruleCategories,
      budgets: budgets.data.map((row) => ({
        category: categoryNames.get(row.category_id) ?? 'Uncategorised',
        limitPaise: row.limit_paise,
        spentPaise: row.spent_paise,
      })),
      goals: goals.data.map((row) => ({
        name: row.name,
        targetPaise: row.target_paise,
        savedPaise: row.saved_paise,
        targetDate: row.target_date,
      })),
      now,
    });
    // `now` is a fresh Date each render; the insight only has to be rebuilt
    // when the underlying rows change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    categories.data,
    spend.data,
    changes.data,
    totals.data,
    previousTotals.data,
    budgets.data,
    goals.data,
    month,
  ]);
}

/** What the screen renders: the AI result if there is one, else the rules. */
export function resolveInsight(stored: Insight | null, fallback: Insight): Insight {
  return stored ?? fallback;
}

export type GenerateErrorCode =
  'offline' | 'not_opted_in' | 'rate_limited' | 'not_enough_data' | 'model_unavailable' | 'unknown';

export interface GenerateResult {
  ok: boolean;
  code?: GenerateErrorCode;
  /** Something a person can act on, not an HTTP status. */
  message?: string;
}

const MESSAGES: Record<GenerateErrorCode, string> = {
  offline: 'You are offline. This one needs a connection - the insights below are from your phone.',
  not_opted_in: 'Turn on AI insights first to generate one.',
  rate_limited: "You have used today's generations. The numbers below keep working.",
  not_enough_data: 'Not enough recorded this month to say anything useful yet.',
  model_unavailable: 'Could not reach the insight service. Try again in a moment.',
  unknown: 'Something went wrong generating that. Try again in a moment.',
};

export function describeGenerateError(code: GenerateErrorCode): string {
  return MESSAGES[code];
}

/**
 * The generate action.
 *
 * Nothing here retries on its own: a user who asked once and got an error
 * should decide whether to spend another of the day's generations.
 */
export function useGenerateInsight(month: string = currentMonthKey()) {
  const [isGenerating, setGenerating] = useState(false);
  const [error, setError] = useState<GenerateErrorCode | null>(null);
  const sync = useSyncSummary();
  const isOffline = sync.state === 'offline';

  const generate = useCallback(async (): Promise<GenerateResult> => {
    if (isOffline) {
      setError('offline');
      return { ok: false, code: 'offline', message: MESSAGES.offline };
    }

    setGenerating(true);
    setError(null);

    try {
      const { data, error: invokeError } = await getSupabaseClient().functions.invoke(
        'generate-insights',
        { body: { month } },
      );

      if (invokeError) {
        const code = await readErrorCode(invokeError);
        setError(code);
        return { ok: false, code, message: MESSAGES[code] };
      }

      // The row also arrives by sync, but writing it straight back would race
      // that; the screen re-renders from the synced row either way.
      return {
        ok: true,
        message: (data as { month?: string } | null)?.month ? undefined : undefined,
      };
    } catch {
      setError('unknown');
      return { ok: false, code: 'unknown', message: MESSAGES.unknown };
    } finally {
      setGenerating(false);
    }
  }, [isOffline, month]);

  return { generate, isGenerating, error, isOffline, clearError: () => setError(null) };
}

/**
 * supabase-js wraps a non-2xx response in a FunctionsHttpError whose body has
 * to be read to find out *why* - and why is the whole difference between "you
 * are out of generations" and "something broke".
 */
async function readErrorCode(invokeError: unknown): Promise<GenerateErrorCode> {
  const response = (invokeError as { context?: Response })?.context;

  if (response && typeof response.json === 'function') {
    try {
      const body = (await response.json()) as { error?: string };
      switch (body?.error) {
        case 'not_opted_in':
        case 'rate_limited':
        case 'not_enough_data':
          return body.error;
        case 'model_unavailable':
        case 'invalid_response':
        case 'storage_failed':
          return 'model_unavailable';
        default:
          return 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  // No response at all is a network failure, whatever the status said.
  return 'offline';
}

/** The month before this one, for "last month" on the insights screen. */
export function previousMonthKey(now: Date = new Date()): string {
  return toMonthStartKey(shiftMonth(now, -1));
}
