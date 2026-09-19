import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@powersync/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  AmountInput,
  AmountText,
  Button,
  Card,
  CategoryGrid,
  EmptyState,
  ListItem,
  Screen,
  TextInput,
  useToast,
} from '@/components';
import { useAccounts, useCategories, useTransactionsRepository } from '@/db/hooks';
import type { TransactionRow } from '@/db/repositories/transactions';
import { orderCategories } from '@/features/categories/ordering';
import { useTheme } from '@/theme';

export default function TransactionDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repository = useTransactionsRepository();
  const accounts = useAccounts();
  const categories = useCategories();

  const { data } = useQuery<TransactionRow>(
    'SELECT * FROM transactions WHERE id = ? AND deleted_at IS NULL',
    [id ?? ''],
  );
  const transaction = data[0];

  const [amountPaise, setAmountPaise] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!transaction) {
    return (
      <Screen accessibilityLabel="Transaction detail screen">
        <EmptyState
          icon="receipt-outline"
          title="Transaction not found"
          description="It may have been deleted on another device."
          actionLabel="Back to transactions"
          onAction={() => router.replace('/(tabs)/transactions')}
        />
      </Screen>
    );
  }

  // Local edits start from the stored values, so an unedited field is not
  // overwritten by a stale render.
  const currentAmount = amountPaise ?? transaction.amount_paise;
  const currentNote = note ?? transaction.note ?? '';
  const currentCategory = categoryId ?? transaction.category_id;
  const isTransfer = transaction.type === 'transfer';

  const visibleCategories = orderCategories(
    categories.data.filter((category) =>
      transaction.type === 'income' ? category.type === 'income' : category.type === 'expense',
    ),
  );

  const accountName = (accountId: string | null) =>
    accounts.data.find((account) => account.id === accountId)?.name ?? 'Unknown account';

  const save = async () => {
    if (!repository) {
      return;
    }
    setSaving(true);
    try {
      await repository.update(transaction.id, {
        amount_paise: currentAmount,
        note: currentNote.trim() === '' ? null : currentNote.trim(),
        ...(isTransfer ? {} : { category_id: currentCategory }),
      });
      toast.show('Saved', { tone: 'success' });
      router.back();
    } catch {
      toast.show('Could not save the change', { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!repository) {
      return;
    }
    await repository.remove(transaction.id);
    toast.show('Transaction deleted', {
      tone: 'info',
      action: {
        label: 'Undo',
        onPress: () => {
          void repository.restore(transaction);
        },
      },
    });
    router.back();
  };

  return (
    <Screen accessibilityLabel="Transaction detail screen" scrollable>
      <Card accessibilityLabel="Transaction summary">
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          {transaction.type === 'income'
            ? 'Income'
            : transaction.type === 'transfer'
              ? 'Transfer'
              : 'Expense'}
        </Text>
        <AmountText
          amountPaise={
            transaction.type === 'income' ? transaction.amount_paise : -transaction.amount_paise
          }
          size="large"
          colorBySign={!isTransfer}
        />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          {new Date(transaction.occurred_at).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </Card>

      <AmountInput label="Amount" valuePaise={currentAmount} onChangePaise={setAmountPaise} />

      <TextInput
        label="Note"
        value={currentNote}
        onChangeText={setNote}
        placeholder="What was it for?"
        maxLength={120}
      />

      {isTransfer ? (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            <ListItem title="From" subtitle={accountName(transaction.account_id)} showDivider />
            <ListItem title="To" subtitle={accountName(transaction.to_account_id)} />
          </View>
        </Card>
      ) : (
        <CategoryGrid
          categories={visibleCategories}
          selectedId={currentCategory}
          onSelect={setCategoryId}
          testID="category-grid"
        />
      )}

      {transaction.recurring_rule_id ? (
        <ListItem
          title="Part of a repeat"
          subtitle="Edit the rule to change future entries"
          leading={<Ionicons name="repeat-outline" size={22} color={theme.colors.primary} />}
          trailing={<Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />}
          onPress={() => router.push('/recurring')}
        />
      ) : null}

      <Button label="Save changes" fullWidth loading={saving} onPress={() => void save()} />
      <Button
        label="Delete"
        variant="destructive"
        fullWidth
        onPress={() => void remove()}
        accessibilityLabel="Delete this transaction"
      />
    </Screen>
  );
}
