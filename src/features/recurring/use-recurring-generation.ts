import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useRecurringRulesRepository, useTransactionsRepository } from '@/db/hooks';

import { runRecurringGeneration } from './run-generation';

/**
 * Runs the catch-up on launch and whenever the app returns to the foreground -
 * an app left open overnight should still show this morning's rent.
 *
 * Generation is idempotent, so running it more often than necessary is cheap
 * and running it twice is harmless.
 */
export function useRecurringGeneration() {
  const rules = useRecurringRulesRepository();
  const transactions = useTransactionsRepository();
  const running = useRef(false);

  useEffect(() => {
    if (!rules || !transactions) {
      return;
    }

    const run = () => {
      if (running.current) {
        return;
      }
      running.current = true;

      void runRecurringGeneration({ rules, transactions })
        .catch((error) => {
          // A failure here must never block the app: the rules stay due and
          // the next foreground tries again.
          console.warn('[recurring] generation failed', error);
        })
        .finally(() => {
          running.current = false;
        });
    };

    run();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        run();
      }
    });

    return () => subscription.remove();
  }, [rules, transactions]);
}
