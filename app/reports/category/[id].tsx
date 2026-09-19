import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { AmountText, Card, EmptyState, Screen, TransactionRow } from '@/components';
import { groupByDay, listItemKey, toListItems } from '@/features/ledger/grouping';
import { useTransactionList } from '@/features/transactions/use-transaction-list';
import { useTheme } from '@/theme';
import { formatINR } from '@/utils/money';

/**
 * A category's transactions for the period the Reports tab was showing.
 *
 * The period travels in the URL rather than in a store, so the back stack and
 * a deep link both behave: the list always matches the slice that was tapped.
 */
export default function ReportCategoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id, from, to, name, label } = useLocalSearchParams<{
    id: string;
    from?: string;
    to?: string;
    name?: string;
    label?: string;
  }>();

  const filters = useMemo(
    () => ({
      from,
      to,
      types: ['expense' as const],
      // "Uncategorised" is a real slice on the chart, but it is the absence of
      // a category, so it cannot be filtered by id.
      categoryIds: id === 'uncategorised' ? undefined : [id],
    }),
    [id, from, to],
  );

  const { items, rows, isLoading } = useTransactionList(filters);

  const visible = useMemo(
    () => (id === 'uncategorised' ? rows.filter((row) => !row.categoryName) : rows),
    [id, rows],
  );

  const totalPaise = useMemo(
    () => visible.reduce((total, row) => total + row.amount_paise, 0),
    [visible],
  );

  // Rebuilding the groups for the uncategorised case keeps the day headers'
  // totals honest - filtering the flat list would leave them counting rows
  // that are no longer shown.
  const listItems = useMemo(
    () => (id === 'uncategorised' ? toListItems(groupByDay(visible)) : items),
    [id, items, visible],
  );

  return (
    <Screen accessibilityLabel={`${name ?? 'Category'} transactions`}>
      <Stack.Screen options={{ title: name ?? 'Category' }} />

      <Card accessibilityLabel={`${formatINR(totalPaise)} across ${visible.length} transactions`}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          {name ?? 'Category'}
          {label ? ` · ${label}` : ''}
        </Text>
        <AmountText amountPaise={totalPaise} size="large" />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          {visible.length} {visible.length === 1 ? 'transaction' : 'transactions'}
        </Text>
      </Card>

      {!isLoading && visible.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="Nothing here"
          description="No transactions in this category for the period you were looking at."
        />
      ) : (
        <View style={{ flex: 1 }}>
          <FlashList
            data={listItems}
            keyExtractor={listItemKey}
            renderItem={({ item }) =>
              item.kind === 'header' ? (
                <View style={{ paddingVertical: theme.spacing.sm }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                    {item.heading}
                  </Text>
                </View>
              ) : (
                <TransactionRow
                  transaction={item.transaction}
                  onPress={() => router.push(`/transactions/${item.transaction.id}`)}
                />
              )
            }
          />
        </View>
      )}
    </Screen>
  );
}
