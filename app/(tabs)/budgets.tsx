import { Text, View } from 'react-native';

import { AmountText, Card, CategoryIcon, ProgressBar, ProgressRing, Screen } from '@/components';
import { useTheme } from '@/theme';
import { formatINR } from '@/utils/money';

const SAMPLE_BUDGETS = [
  { id: 'food', label: 'Food & dining', spent: 842000, limit: 1000000, category: 'food' },
  { id: 'transport', label: 'Transport', spent: 312000, limit: 500000, category: 'transport' },
  { id: 'shopping', label: 'Shopping', spent: 1260000, limit: 1000000, category: 'shopping' },
] as const;

export default function BudgetsScreen() {
  const theme = useTheme();
  const totalSpent = SAMPLE_BUDGETS.reduce((sum, budget) => sum + budget.spent, 0);
  const totalLimit = SAMPLE_BUDGETS.reduce((sum, budget) => sum + budget.limit, 0);

  return (
    <Screen accessibilityLabel="Budgets screen" scrollable>
      <Card accessibilityLabel="Overall budget">
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <ProgressRing
            progress={totalSpent / totalLimit}
            accessibilityLabel="Overall budget used"
            tone="primary"
          >
            <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
              {Math.round((totalSpent / totalLimit) * 100)}%
            </Text>
          </ProgressRing>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {formatINR(totalSpent, { withDecimals: false })} of{' '}
            {formatINR(totalLimit, { withDecimals: false })}
          </Text>
        </View>
      </Card>

      {SAMPLE_BUDGETS.map((budget) => (
        <Card key={budget.id} accessibilityLabel={`${budget.label} budget`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <CategoryIcon category={budget.category} />
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
                  {budget.label}
                </Text>
                <AmountText amountPaise={budget.spent} size="small" />
              </View>
              <ProgressBar
                progress={budget.spent / budget.limit}
                autoTone
                accessibilityLabel={`${budget.label} budget used`}
              />
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                of {formatINR(budget.limit, { withDecimals: false })}
              </Text>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
