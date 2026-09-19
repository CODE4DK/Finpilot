import { useCallback, useEffect, useRef } from 'react';

import { useBudgetProgress, useBudgetsRepository, useCategories } from '@/db/hooks';
import { toMonthStartKey } from '@/features/ledger/period';
import { useSettingsStore } from '@/stores/settings-store';
import { formatINR } from '@/utils/money';

import { alertCopy, collectAlerts, flagsForDeliveredAlert } from './alerts';
import { deliver } from './notifications';

/**
 * Watches this month's budgets and fires a notification the first time each
 * one crosses 80% and 100%.
 *
 * The flags are written **after** the notification is delivered, and they are
 * synced columns - so a second device that receives the same budget row will
 * not announce it again.
 */
export function useBudgetAlerts() {
  const alertsEnabled = useSettingsStore((state) => state.budgetAlertsEnabled);
  const month = toMonthStartKey(new Date());
  const { data: budgets } = useBudgetProgress(month);
  const categories = useCategories();
  const repository = useBudgetsRepository();

  // Guards against a second pass while the first is still writing flags.
  const delivering = useRef(false);

  const run = useCallback(async () => {
    if (!alertsEnabled || !repository || delivering.current) {
      return;
    }

    const pending = collectAlerts(budgets);
    if (pending.length === 0) {
      return;
    }

    delivering.current = true;
    try {
      for (const alert of pending) {
        const category = categories.data.find((candidate) => candidate.id === alert.categoryId);
        const copy = alertCopy(alert, category?.name ?? 'Budget', (paise) =>
          formatINR(paise, { withDecimals: false }),
        );

        const delivered = await deliver({
          title: copy.title,
          body: copy.body,
          data: { budgetId: alert.budgetId, threshold: alert.threshold },
        });

        // Only mark it sent if it actually went out; a revoked permission
        // must not silently burn the one alert this budget gets.
        if (delivered) {
          await repository.update(alert.budgetId, flagsForDeliveredAlert(alert.threshold));
        }
      }
    } finally {
      delivering.current = false;
    }
  }, [alertsEnabled, budgets, categories.data, repository]);

  useEffect(() => {
    void run();
  }, [run]);
}
