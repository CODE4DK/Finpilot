import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  useAccounts,
  useCategories,
  useRecurringRulesRepository,
  useTransactionsRepository,
} from '@/db/hooks';
import { orderCategories, type UsageRecord } from '@/features/categories/ordering';
import { advance } from '@/features/recurring/schedule';

import {
  canSave,
  createDraft,
  setType as setDraftType,
  toRecurringRuleValues,
  toTransactionValues,
  validateDraft,
  type DraftRecurrence,
  type TransactionDraft,
} from './draft';
import type { TransactionType } from '@/db/enums';

/**
 * Everything the Add screen needs, so the screen file stays a layout.
 *
 * The defaults matter more than they look: the account comes from the last
 * saved transaction and the date from the clock, which is what gets an expense
 * down to two taps after the amount is typed.
 */
export function useAddTransaction(recentUsage: readonly UsageRecord[] = []) {
  const accounts = useAccounts();
  const categories = useCategories();
  const transactionsRepo = useTransactionsRepository();
  const rulesRepo = useRecurringRulesRepository();

  const [draft, setDraft] = useState<TransactionDraft>(() => createDraft());
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  const liveAccounts = useMemo(
    () => accounts.data.filter((account) => account.is_archived === 0),
    [accounts.data],
  );

  // Seed the default account once the accounts have loaded.
  useEffect(() => {
    if (seeded || liveAccounts.length === 0 || !transactionsRepo) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const lastAccountId = await transactionsRepo.lastUsedAccountId();
      if (cancelled) {
        return;
      }
      setDraft((current) => ({
        ...current,
        accountId: current.accountId ?? lastAccountId ?? liveAccounts[0]?.id ?? null,
      }));
      setSeeded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [liveAccounts, seeded, transactionsRepo]);

  const visibleCategories = useMemo(() => {
    const forType = categories.data.filter((category) =>
      draft.type === 'income' ? category.type === 'income' : category.type === 'expense',
    );
    return orderCategories(forType, recentUsage);
  }, [categories.data, draft.type, recentUsage]);

  const setType = useCallback((type: TransactionType) => {
    setDraft((current) => setDraftType(current, type));
  }, []);

  const setAmount = useCallback((amountPaise: number | null) => {
    setDraft((current) => ({ ...current, amountPaise }));
  }, []);

  const setCategory = useCallback((categoryId: string) => {
    setDraft((current) => ({ ...current, categoryId }));
  }, []);

  const setAccount = useCallback((accountId: string) => {
    setDraft((current) => ({ ...current, accountId }));
  }, []);

  const setToAccount = useCallback((toAccountId: string) => {
    setDraft((current) => ({ ...current, toAccountId }));
  }, []);

  const setNote = useCallback((note: string) => {
    setDraft((current) => ({ ...current, note }));
  }, []);

  const setOccurredAt = useCallback((occurredAt: Date) => {
    setDraft((current) => ({ ...current, occurredAt }));
  }, []);

  const setRecurrence = useCallback((recurrence: DraftRecurrence | null) => {
    setDraft((current) => ({ ...current, recurrence }));
  }, []);

  const reset = useCallback(() => {
    setDraft((current) => createDraft({ lastAccountId: current.accountId, now: new Date() }));
  }, []);

  /**
   * Saves the transaction, and the repeating rule when one was chosen. The
   * rule starts at the *next* occurrence: the transaction being saved covers
   * today.
   */
  const save = useCallback(async () => {
    if (!transactionsRepo || !canSave(draft)) {
      return null;
    }

    setSaving(true);
    try {
      const id = await transactionsRepo.insert(toTransactionValues(draft));

      if (draft.recurrence && rulesRepo) {
        const nextRunAt = advance(draft.occurredAt, {
          frequency: draft.recurrence.frequency,
          interval: draft.recurrence.interval,
        });
        const ruleId = await rulesRepo.insert(toRecurringRuleValues(draft, nextRunAt));
        await transactionsRepo.update(id, { recurring_rule_id: ruleId });
      }

      return id;
    } finally {
      setSaving(false);
    }
  }, [draft, rulesRepo, transactionsRepo]);

  return {
    draft,
    accounts: liveAccounts,
    categories: visibleCategories,
    problems: validateDraft(draft),
    canSave: canSave(draft) && !saving,
    saving,
    setType,
    setAmount,
    setCategory,
    setAccount,
    setToAccount,
    setNote,
    setOccurredAt,
    setRecurrence,
    reset,
    save,
  };
}
