import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AmountInput, Button, Chip, Screen, useToast } from '@/components';
import { useBudgetProgress, useBudgetsRepository, useCategories } from '@/db/hooks';
import { toMonthStartKey } from '@/features/ledger/period';
import { useTheme } from '@/theme';
import { formatINR } from '@/utils/money';

import { normaliseLimit } from './budget-math';

export interface BudgetFormScreenProps {
  /** Present when editing an existing budget. */
  budgetId?: string;
  title: string;
  accessibilityLabel: string;
}

export function BudgetFormScreen({ budgetId, title, accessibilityLabel }: BudgetFormScreenProps) {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const repository = useBudgetsRepository();

  const month = useMemo(() => toMonthStartKey(new Date()), []);
  const { data: budgets } = useBudgetProgress(month);
  const categories = useCategories('expense');

  const existing = budgetId ? budgets.find((budget) => budget.id === budgetId) : undefined;

  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? null);
  const [limitPaise, setLimitPaise] = useState<number | null>(existing?.limit_paise ?? null);
  const [saving, setSaving] = useState(false);

  // A category can only hold one live budget per month, so the picker hides
  // the ones already taken rather than letting the insert fail.
  const availableCategories = useMemo(() => {
    const taken = new Set(
      budgets.filter((budget) => budget.id !== budgetId).map((budget) => budget.category_id),
    );
    return categories.data.filter((category) => !taken.has(category.id));
  }, [budgetId, budgets, categories.data]);

  const normalised = normaliseLimit(limitPaise);
  const canSave = Boolean(categoryId) && normalised !== null;

  const save = async () => {
    if (!repository || !categoryId || normalised === null) {
      return;
    }

    setSaving(true);
    try {
      if (existing) {
        await repository.setLimit(existing.id, normalised, existing.limit_paise);
        toast.show('Budget updated', { tone: 'success' });
      } else {
        await repository.insert({ category_id: categoryId, month, limit_paise: normalised });
        toast.show('Budget set', { tone: 'success' });
      }
      router.back();
    } catch {
      toast.show('Could not save the budget', { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!repository || !existing) {
      return;
    }
    await repository.remove(existing.id);
    toast.show('Budget removed');
    router.back();
  };

  return (
    <Screen accessibilityLabel={accessibilityLabel} scrollable>
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>{title}</Text>

      {existing ? null : (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>
            Category
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {availableCategories.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                selected={categoryId === category.id}
                onPress={() => setCategoryId(category.id)}
                accessibilityLabel={`Budget for ${category.name}`}
              />
            ))}
          </View>
          {availableCategories.length === 0 ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              Every expense category already has a budget this month.
            </Text>
          ) : null}
        </View>
      )}

      <AmountInput
        label="Monthly limit"
        valuePaise={limitPaise}
        onChangePaise={setLimitPaise}
        autoFocus
        hint="You'll be told when you reach 80% and when you reach the limit."
      />

      {existing ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          Spent so far: {formatINR(existing.spent_paise)}. Raising the limit lets FinPilot warn you
          again.
        </Text>
      ) : null}

      <Button
        label={existing ? 'Save changes' : 'Set budget'}
        fullWidth
        loading={saving}
        disabled={!canSave}
        onPress={() => void save()}
      />

      {existing ? (
        <Button
          label="Remove budget"
          variant="destructive"
          fullWidth
          onPress={() => void remove()}
          accessibilityLabel="Remove this budget"
        />
      ) : null}
    </Screen>
  );
}
