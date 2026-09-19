import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AmountText,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Screen,
  SwipeRow,
  TextInput,
  TransactionRow,
  useToast,
} from '@/components';
import { useAccounts, useCategories, useTransactionsRepository } from '@/db/hooks';
import type { TransactionRow as TransactionRecord } from '@/db/repositories/transactions';
import { listItemKey } from '@/features/ledger/grouping';
import {
  useTransactionFilters,
  useTransactionList,
  type TransactionListRow,
} from '@/features/transactions/use-transaction-list';
import { monthPeriod, shiftMonth } from '@/features/ledger/period';
import { useTheme } from '@/theme';
import type { TransactionType } from '@/db/enums';

const TYPE_FILTERS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfers' },
];

export default function TransactionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const repository = useTransactionsRepository();
  const accounts = useAccounts();
  const categories = useCategories();

  const { filters, setFilters, activeCount, clear, setSearch } = useTransactionFilters();
  const { items, isLoading } = useTransactionList(filters);
  const [filterSheet, setFilterSheet] = useState(false);
  const [search, setSearchText] = useState('');

  /**
   * Deleting is soft and reversible: the row is removed locally (the connector
   * turns that into a server-side deleted_at) and the toast offers to put it
   * back with its original id, so the restore reaches every device too.
   */
  const remove = useCallback(
    async (id: string) => {
      if (!repository) {
        return;
      }
      const original = (await repository.findById(id)) as TransactionRecord | null;
      if (!original) {
        return;
      }

      await repository.remove(id);
      toast.show('Transaction deleted', {
        tone: 'info',
        action: {
          label: 'Undo',
          onPress: () => {
            void repository.restore(original);
          },
        },
      });
    },
    [repository, toast],
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof items)[number] }) => {
      if (item.kind === 'header') {
        return (
          <View
            style={[
              styles.header,
              {
                backgroundColor: theme.colors.background,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.sm,
              },
            ]}
          >
            <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>
              {item.heading}
            </Text>
            <AmountText
              amountPaise={item.totals.netPaise}
              size="small"
              colorBySign
              formatOptions={{ signDisplay: 'always' }}
            />
          </View>
        );
      }

      const transaction = item.transaction as TransactionListRow;
      return (
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <SwipeRow
            testID={`swipe-${transaction.id}`}
            rightActions={[
              {
                label: 'Delete',
                icon: 'trash-outline',
                tone: 'expense',
                onPress: () => void remove(transaction.id),
              },
            ]}
            leftActions={[
              {
                label: 'Edit',
                icon: 'create-outline',
                tone: 'primary',
                onPress: () => router.push(`/transactions/${transaction.id}`),
              },
            ]}
          >
            <TransactionRow
              transaction={transaction}
              onPress={() => router.push(`/transactions/${transaction.id}`)}
            />
          </SwipeRow>
        </View>
      );
    },
    [remove, router, theme],
  );

  return (
    <Screen accessibilityLabel="Transactions screen" padded={false} keyboardAvoiding={false}>
      <View style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <TextInput
          label="Search"
          labelHidden
          placeholder="Search notes and categories"
          value={search}
          onChangeText={(next) => {
            setSearchText(next);
            setSearch(next);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          leading={<Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />}
        />

        <View style={[styles.chipRow, { gap: theme.spacing.sm }]}>
          <Chip
            label={activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
            selected={activeCount > 0}
            onPress={() => setFilterSheet(true)}
            accessibilityLabel={
              activeCount > 0 ? `Filters, ${activeCount} applied` : 'Open filters'
            }
          />
          <Chip
            label="This month"
            selected={Boolean(filters.from)}
            onPress={() => {
              const period = monthPeriod(new Date());
              setFilters((current) =>
                current.from
                  ? { ...current, from: undefined, to: undefined }
                  : { ...current, ...period },
              );
            }}
            accessibilityLabel="Filter to this month"
          />
          <Chip
            label="Last month"
            onPress={() =>
              setFilters((current) => ({ ...current, ...monthPeriod(shiftMonth(new Date(), -1)) }))
            }
            accessibilityLabel="Filter to last month"
          />
        </View>
      </View>

      {items.length === 0 && !isLoading ? (
        <EmptyState
          icon="receipt-outline"
          title={activeCount > 0 || search ? 'Nothing matches' : 'No transactions yet'}
          description={
            activeCount > 0 || search
              ? 'Try a different search or clear the filters.'
              : 'Tap the + button to add your first one.'
          }
          actionLabel={activeCount > 0 || search ? 'Clear filters' : undefined}
          onAction={
            activeCount > 0 || search
              ? () => {
                  clear();
                  setSearchText('');
                }
              : undefined
          }
        />
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={listItemKey}
          testID="transaction-list"
          contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}
        />
      )}

      <BottomSheet
        visible={filterSheet}
        onClose={() => setFilterSheet(false)}
        title="Filters"
        testID="filter-sheet"
      >
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <FilterGroup title="Type">
            {TYPE_FILTERS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={filters.types?.includes(option.value) ?? false}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    types: toggle(current.types, option.value),
                  }))
                }
                accessibilityLabel={`Filter by ${option.label}`}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Account">
            {accounts.data.map((account) => (
              <Chip
                key={account.id}
                label={account.name}
                selected={filters.accountIds?.includes(account.id) ?? false}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    accountIds: toggle(current.accountIds, account.id),
                  }))
                }
                accessibilityLabel={`Filter by ${account.name}`}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Category">
            {categories.data.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                selected={filters.categoryIds?.includes(category.id) ?? false}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    categoryIds: toggle(current.categoryIds, category.id),
                  }))
                }
                accessibilityLabel={`Filter by ${category.name}`}
              />
            ))}
          </FilterGroup>

          <Button
            label="Clear all"
            variant="secondary"
            fullWidth
            onPress={() => {
              clear();
              setSearchText('');
            }}
          />
          <Button label="Done" fullWidth onPress={() => setFilterSheet(false)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.chipRow, { gap: theme.spacing.sm }]}>{children}</View>
    </View>
  );
}

/** Adds or removes a value from an optional filter array. */
function toggle<T>(values: T[] | undefined, value: T): T[] | undefined {
  const current = values ?? [];
  const next = current.includes(value)
    ? current.filter((candidate) => candidate !== value)
    : [...current, value];
  return next.length > 0 ? next : undefined;
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
