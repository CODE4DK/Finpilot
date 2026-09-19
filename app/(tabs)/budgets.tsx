import { useMemo } from 'react';
import { Text, View } from 'react-native';

import {
  AmountText,
  Card,
  CategoryIcon,
  EmptyState,
  ProgressBar,
  ProgressRing,
  Screen,
} from '@/components';
import { useBudgetProgress, useCategories } from '@/db/hooks';
import { toMonthStartKey } from '@/features/ledger/period';
import { useTheme } from '@/theme';
import { addPaise, formatINR } from '@/utils/money';

export default function BudgetsScreen() {
  const theme = useTheme();
  const month = useMemo(() => toMonthStartKey(new Date()), []);
  const { data: budgets } = useBudgetProgress(month);
  const categories = useCategories();

  const categoryFor = (id: string) => categories.data.find((category) => category.id === id);

  const { spent, limit } = useMemo(
    () =>
      budgets.reduce(
        (totals, budget) => ({
          spent: addPaise(totals.spent, budget.spent_paise),
          limit: addPaise(totals.limit, budget.limit_paise),
        }),
        { spent: 0, limit: 0 },
      ),
    [budgets],
  );

  if (budgets.length === 0) {
    return (
      <Screen accessibilityLabel="Budgets screen">
        <EmptyState
          icon="pie-chart-outline"
          title="No budgets for this month"
          description="Set a monthly limit on a category and this screen will track what you have left."
        />
      </Screen>
    );
  }

  return (
    <Screen accessibilityLabel="Budgets screen" scrollable>
      <Card accessibilityLabel="Overall budget">
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <ProgressRing
            progress={limit === 0 ? 0 : spent / limit}
            accessibilityLabel="Overall budget used"
            tone="primary"
          >
            <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
              {limit === 0 ? '0%' : `${Math.round((spent / limit) * 100)}%`}
            </Text>
          </ProgressRing>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {formatINR(spent, { withDecimals: false })} of{' '}
            {formatINR(limit, { withDecimals: false })}
          </Text>
        </View>
      </Card>

      {budgets.map((budget) => {
        const category = categoryFor(budget.category_id);

        return (
          <Card key={budget.id} accessibilityLabel={`${category?.name ?? 'Category'} budget`}>
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
                  progress={budget.limit_paise === 0 ? 0 : budget.spent_paise / budget.limit_paise}
                  autoTone
                  accessibilityLabel={`${category?.name ?? 'Category'} budget used`}
                />
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                  of {formatINR(budget.limit_paise, { withDecimals: false })}
                </Text>
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
