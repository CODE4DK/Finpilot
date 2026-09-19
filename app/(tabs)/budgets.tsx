import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  AmountText,
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  ProgressBar,
  ProgressRing,
  Screen,
  useToast,
} from '@/components';
import { useBudgetProgress, useBudgetsRepository, useCategories } from '@/db/hooks';
import {
  describePace,
  summariseBudgets,
  toneFor,
  usedPercentage,
} from '@/features/budgets/budget-math';
import { useBudgetAlerts } from '@/features/budgets/use-budget-alerts';
import { shiftMonth, toMonthStartKey } from '@/features/ledger/period';
import { useTheme } from '@/theme';
import { formatINR } from '@/utils/money';

export default function BudgetsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const repository = useBudgetsRepository();

  const month = useMemo(() => toMonthStartKey(new Date()), []);
  const lastMonth = useMemo(() => toMonthStartKey(shiftMonth(new Date(), -1)), []);
  const { data: budgets } = useBudgetProgress(month);
  const categories = useCategories();
  const [lastMonthCount, setLastMonthCount] = useState(0);
  const [copying, setCopying] = useState(false);

  // Fires the 80% and 100% notifications, once each per budget per month.
  useBudgetAlerts();

  useEffect(() => {
    if (!repository) {
      return;
    }
    void repository.countForMonth(lastMonth).then(setLastMonthCount);
  }, [lastMonth, repository]);

  const summary = useMemo(() => summariseBudgets(budgets), [budgets]);
  const categoryFor = (id: string) => categories.data.find((category) => category.id === id);

  const copyLastMonth = async () => {
    if (!repository) {
      return;
    }
    setCopying(true);
    try {
      const copied = await repository.copyFrom(lastMonth, month);
      toast.show(
        copied === 0
          ? 'Everything from last month is already budgeted'
          : `Copied ${copied} ${copied === 1 ? 'budget' : 'budgets'} from last month`,
        { tone: copied === 0 ? 'info' : 'success' },
      );
    } catch {
      toast.show('Could not copy last month’s budgets', { tone: 'error' });
    } finally {
      setCopying(false);
    }
  };

  if (budgets.length === 0) {
    return (
      <Screen accessibilityLabel="Budgets screen" scrollable>
        <EmptyState
          icon="pie-chart-outline"
          title="No budgets for this month"
          description="Set a monthly limit on a category and this screen will track what you have left."
          actionLabel="Set a budget"
          onAction={() => router.push('/budgets/new')}
        />
        {lastMonthCount > 0 ? (
          <Button
            label={`Copy last month’s ${lastMonthCount} ${
              lastMonthCount === 1 ? 'budget' : 'budgets'
            }`}
            variant="secondary"
            fullWidth
            loading={copying}
            onPress={() => void copyLastMonth()}
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen accessibilityLabel="Budgets screen" scrollable>
      <Card accessibilityLabel="Monthly budget summary">
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <ProgressRing
            progress={summary.usedFraction}
            tone={summary.tone}
            accessibilityLabel={`${summary.usedPercentage}% of this month's budget used`}
          >
            <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
              {summary.usedPercentage}%
            </Text>
          </ProgressRing>

          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {formatINR(summary.spentPaise, { withDecimals: false })} of{' '}
            {formatINR(summary.limitPaise, { withDecimals: false })}
          </Text>

          <View
            style={{ flexDirection: 'row', gap: theme.spacing.xl, marginTop: theme.spacing.sm }}
          >
            <View style={{ alignItems: 'center' }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                Days left
              </Text>
              <Text style={[theme.typography.amountSmall, { color: theme.colors.text }]}>
                {summary.daysLeft}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                Safe per day
              </Text>
              <Text
                accessibilityLabel={`Safe to spend ${formatINR(
                  summary.safeToSpendPerDayPaise,
                )} per day`}
                style={[theme.typography.amountSmall, { color: theme.colors.text }]}
              >
                {formatINR(summary.safeToSpendPerDayPaise, { withDecimals: false })}
              </Text>
            </View>
          </View>

          {summary.overCount > 0 ? (
            <Text style={[theme.typography.caption, { color: theme.colors.expense }]}>
              {summary.overCount} {summary.overCount === 1 ? 'budget is' : 'budgets are'} over
            </Text>
          ) : null}
        </View>
      </Card>

      {budgets.map((budget) => {
        const category = categoryFor(budget.category_id);
        const percentage = usedPercentage(budget.spent_paise, budget.limit_paise);

        return (
          <Card
            key={budget.id}
            accessibilityLabel={`${category?.name ?? 'Category'} budget, ${percentage}% used`}
            onPress={() => router.push(`/budgets/${budget.id}`)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <CategoryIcon glyph={category?.icon} color={category?.color ?? undefined} />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
                    {category?.name ?? 'Uncategorised'}
                  </Text>
                  <AmountText amountPaise={budget.spent_paise} size="small" />
                </View>

                <ProgressBar
                  progress={budget.spent_paise / Math.max(budget.limit_paise, 1)}
                  tone={toneFor(budget.spent_paise, budget.limit_paise)}
                  accessibilityLabel={`${category?.name ?? 'Category'} budget used`}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                    of {formatINR(budget.limit_paise, { withDecimals: false })} · {percentage}%
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                    {describePace(budget.spent_paise, budget.limit_paise)}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        );
      })}

      <Button
        label="Set a budget"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/budgets/new')}
        leading={<Ionicons name="add" size={20} color={theme.colors.text} />}
      />

      {lastMonthCount > 0 ? (
        <Button
          label="Copy last month’s budgets"
          variant="tertiary"
          fullWidth
          loading={copying}
          onPress={() => void copyLastMonth()}
        />
      ) : null}
    </Screen>
  );
}
