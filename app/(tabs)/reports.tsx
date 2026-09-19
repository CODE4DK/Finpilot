import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AmountText, Card, CategoryIcon, Chip, EmptyState, Screen } from '@/components';
import { useCategories, useSpendByCategory, useTransactionTotals } from '@/db/hooks';
import { monthPeriod, shiftMonth, trailingPeriod } from '@/features/ledger/period';
import { useTheme } from '@/theme';
import { formatINR, percentageOfPaise, subtractPaise } from '@/utils/money';

type Range = 'month' | 'quarter' | 'year';

const RANGES: { value: Range; label: string; days: number | null }[] = [
  { value: 'month', label: 'Month', days: null },
  { value: 'quarter', label: 'Quarter', days: 90 },
  { value: 'year', label: 'Year', days: 365 },
];

export default function ReportsScreen() {
  const theme = useTheme();
  const [range, setRange] = useState<Range>('month');

  const period = useMemo(() => {
    if (range === 'month') {
      return monthPeriod(new Date());
    }
    return trailingPeriod(range === 'quarter' ? 90 : 365, new Date());
  }, [range]);

  const totals = useTransactionTotals(period.from, period.to);
  const spend = useSpendByCategory(period.from, period.to);
  const categories = useCategories();

  const { income_paise: income = 0, expense_paise: expense = 0 } = totals.data[0] ?? {};
  const net = subtractPaise(income, expense);

  const previous = useMemo(() => monthPeriod(shiftMonth(new Date(), -1)), []);
  const previousTotals = useTransactionTotals(previous.from, previous.to);
  const previousExpense = previousTotals.data[0]?.expense_paise ?? 0;

  return (
    <Screen accessibilityLabel="Reports screen" scrollable>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {RANGES.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={range === option.value}
            onPress={() => setRange(option.value)}
            accessibilityLabel={`Show the last ${option.label.toLowerCase()}`}
          />
        ))}
      </View>

      <Card accessibilityLabel="Cash flow summary">
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          Net {range === 'month' ? 'this month' : `over the last ${range}`}
        </Text>
        <AmountText amountPaise={net} size="large" colorBySign />

        <View style={{ flexDirection: 'row', gap: theme.spacing.xl, marginTop: theme.spacing.md }}>
          <View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>In</Text>
            <AmountText amountPaise={income} size="small" colorBySign />
          </View>
          <View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Out</Text>
            <AmountText amountPaise={-expense} size="small" colorBySign />
          </View>
        </View>

        {range === 'month' && previousExpense > 0 ? (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, marginTop: theme.spacing.sm },
            ]}
          >
            Last month you spent {formatINR(previousExpense, { withDecimals: false })}.
          </Text>
        ) : null}
      </Card>

      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Where it went</Text>

      {spend.data.length === 0 ? (
        <EmptyState
          icon="bar-chart-outline"
          title="Nothing to report yet"
          description="Once you have some spending, this shows where it went."
        />
      ) : (
        <Card padded={false}>
          <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
            {spend.data.slice(0, 8).map((row) => {
              const category = categories.data.find(
                (candidate) => candidate.id === row.category_id,
              );
              const share = percentageOfPaise(row.spent_paise, expense, 0);

              return (
                <View
                  key={row.category_id ?? 'uncategorised'}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
                  accessibilityLabel={`${category?.name ?? 'Uncategorised'}, ${formatINR(
                    row.spent_paise,
                  )}, ${share}% of spending`}
                >
                  <CategoryIcon glyph={category?.icon} color={category?.color ?? undefined} />
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
                      {category?.name ?? 'Uncategorised'}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                      {share}% of spending
                    </Text>
                  </View>
                  <AmountText amountPaise={row.spent_paise} size="small" />
                </View>
              );
            })}
          </View>
        </Card>
      )}

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        Charts arrive with Victory Native in a later phase. These numbers are live.
      </Text>
    </Screen>
  );
}
