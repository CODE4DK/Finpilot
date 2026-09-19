import { StyleSheet, Text, View } from 'react-native';

import { AmountText } from '@/components/amount-text';
import { CategoryIcon } from '@/components/category-icon';
import { ListItem } from '@/components/list-item';
import { useTheme } from '@/theme';
import { formatINR } from '@/utils/money';

export interface TransactionRowData {
  id: string;
  type: string;
  amount_paise: number;
  note: string | null;
  occurred_at: string;
  categoryName?: string | null;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  accountName?: string | null;
  toAccountName?: string | null;
}

export interface TransactionRowProps {
  transaction: TransactionRowData;
  onPress?: () => void;
  showDivider?: boolean;
}

/** "12:30 pm · HDFC" - the second line of a transaction row. */
export function describeTransaction(transaction: TransactionRowData): string {
  const time = new Date(transaction.occurred_at).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (transaction.type === 'transfer') {
    const from = transaction.accountName ?? 'Account';
    const to = transaction.toAccountName ?? 'Account';
    return `${time} · ${from} → ${to}`;
  }

  const parts = [time, transaction.categoryName, transaction.accountName].filter(Boolean);
  return parts.join(' · ');
}

/** The title: the note if there is one, otherwise the category. */
export function titleFor(transaction: TransactionRowData): string {
  if (transaction.note?.trim()) {
    return transaction.note.trim();
  }
  if (transaction.type === 'transfer') {
    return 'Transfer';
  }
  return transaction.categoryName ?? 'Uncategorised';
}

export function TransactionRow({ transaction, onPress, showDivider }: TransactionRowProps) {
  const theme = useTheme();
  const isTransfer = transaction.type === 'transfer';

  // Transfers are neither income nor expense, so they are drawn neutrally.
  const signedAmount =
    transaction.type === 'income' ? transaction.amount_paise : -transaction.amount_paise;

  return (
    <ListItem
      title={titleFor(transaction)}
      subtitle={describeTransaction(transaction)}
      leading={
        isTransfer ? (
          <CategoryIcon glyph="swap-horizontal-outline" color={theme.colors.textSecondary} />
        ) : (
          <CategoryIcon
            glyph={transaction.categoryIcon}
            color={transaction.categoryColor ?? undefined}
          />
        )
      }
      trailing={
        isTransfer ? (
          <View style={styles.trailing}>
            <Text style={[theme.typography.amountSmall, { color: theme.colors.textSecondary }]}>
              {formatINR(transaction.amount_paise)}
            </Text>
          </View>
        ) : (
          <AmountText amountPaise={signedAmount} size="small" colorBySign />
        )
      }
      onPress={onPress}
      showDivider={showDivider}
      testID={`transaction-${transaction.id}`}
    />
  );
}

const styles = StyleSheet.create({
  trailing: {
    alignItems: 'flex-end',
  },
});
