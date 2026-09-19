import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import {
  AmountInput,
  BottomSheet,
  Button,
  CategoryGrid,
  Chip,
  ListItem,
  Screen,
  SegmentedControl,
  TextInput,
  useToast,
} from '@/components';
import { useTransactionsRepository } from '@/db/hooks';
import { useQuery } from '@powersync/react-native';
import { DEFAULT_RECENT_LIMIT, recentCount } from '@/features/categories/ordering';
import { describeProblem } from '@/features/transactions/draft';
import { useAddTransaction } from '@/features/transactions/use-add-transaction';
import { describeRecurrence } from '@/features/recurring/schedule';
import { useTheme } from '@/theme';
import type { TransactionType } from '@/db/enums';

const TYPE_OPTIONS = [
  { value: 'expense' as const, label: 'Expense', tone: 'expense' as const },
  { value: 'income' as const, label: 'Income', tone: 'income' as const },
  { value: 'transfer' as const, label: 'Transfer', tone: 'primary' as const },
];

const FREQUENCIES = [
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
  { value: 'yearly' as const, label: 'Yearly' },
];

export default function AddTransactionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const transactionsRepo = useTransactionsRepository();

  // Recently used categories drive the grid order, which is what keeps the
  // common expense down to two taps.
  const recentQuery = transactionsRepo?.recentCategoriesQuery(DEFAULT_RECENT_LIMIT);
  const { data: usage } = useQuery<{
    category_id: string | null;
    last_used_at: string;
    uses: number;
  }>(recentQuery?.sql ?? 'SELECT 1 WHERE 0', recentQuery?.parameters ?? []);

  const form = useAddTransaction(usage);
  const [accountSheet, setAccountSheet] = useState<'from' | 'to' | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const accountName = (id: string | null) =>
    form.accounts.find((account) => account.id === id)?.name ?? 'Choose account';

  const handleSave = async () => {
    const id = await form.save();
    if (!id) {
      toast.show(form.problems[0] ? describeProblem(form.problems[0]) : 'Could not save', {
        tone: 'error',
      });
      return;
    }
    toast.show('Saved', { tone: 'success' });
    form.reset();
    router.push('/(tabs)/transactions');
  };

  return (
    <Screen accessibilityLabel="Add transaction screen" scrollable>
      <SegmentedControl
        options={TYPE_OPTIONS}
        value={form.draft.type}
        onChange={(type: TransactionType) => form.setType(type)}
        accessibilityLabel="Transaction type"
        testID="type-toggle"
      />

      <AmountInput
        label="Amount"
        valuePaise={form.draft.amountPaise}
        onChangePaise={form.setAmount}
        autoFocus
        showPreview={false}
        inputStyle={styles.amount}
      />

      {form.draft.type === 'transfer' ? (
        <View style={{ gap: theme.spacing.sm }}>
          <ListItem
            title="From"
            subtitle={accountName(form.draft.accountId)}
            leading={
              <Ionicons name="arrow-up-circle-outline" size={22} color={theme.colors.expense} />
            }
            onPress={() => setAccountSheet('from')}
            accessibilityLabel={`Transfer from ${accountName(form.draft.accountId)}`}
            showDivider
          />
          <ListItem
            title="To"
            subtitle={accountName(form.draft.toAccountId)}
            leading={
              <Ionicons name="arrow-down-circle-outline" size={22} color={theme.colors.income} />
            }
            onPress={() => setAccountSheet('to')}
            accessibilityLabel={`Transfer to ${accountName(form.draft.toAccountId)}`}
          />
        </View>
      ) : (
        <CategoryGrid
          categories={form.categories}
          selectedId={form.draft.categoryId}
          onSelect={form.setCategory}
          recentCount={recentCount(form.categories, usage)}
          testID="category-grid"
        />
      )}

      {form.draft.type !== 'transfer' ? (
        <ListItem
          title="Account"
          subtitle={accountName(form.draft.accountId)}
          leading={<Ionicons name="wallet-outline" size={22} color={theme.colors.primary} />}
          trailing={<Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />}
          onPress={() => setAccountSheet('from')}
          accessibilityLabel={`Account, ${accountName(form.draft.accountId)}`}
        />
      ) : null}

      <ListItem
        title="Date"
        subtitle={form.draft.occurredAt.toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
        leading={<Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />}
        trailing={<Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />}
        onPress={() => setShowDatePicker(true)}
        accessibilityLabel="Change the date and time"
      />

      <TextInput
        label="Note"
        placeholder="What was it for?"
        value={form.draft.note}
        onChangeText={form.setNote}
        maxLength={120}
      />

      <ListItem
        title="Repeat"
        subtitle={
          form.draft.recurrence
            ? describeRecurrence(
                form.draft.recurrence.frequency,
                form.draft.recurrence.interval,
                form.draft.occurredAt.getDate(),
              )
            : 'One-off'
        }
        leading={<Ionicons name="repeat-outline" size={22} color={theme.colors.primary} />}
        trailing={
          <Switch
            accessibilityLabel="Repeat this transaction"
            value={form.draft.recurrence !== null}
            onValueChange={(on) =>
              form.setRecurrence(on ? { frequency: 'monthly', interval: 1, endAt: null } : null)
            }
          />
        }
      />

      {form.draft.recurrence ? (
        <View style={[styles.chipRow, { gap: theme.spacing.sm }]}>
          {FREQUENCIES.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={form.draft.recurrence?.frequency === option.value}
              onPress={() =>
                form.setRecurrence({
                  frequency: option.value,
                  interval: form.draft.recurrence?.interval ?? 1,
                  endAt: form.draft.recurrence?.endAt ?? null,
                })
              }
              accessibilityLabel={`Repeat ${option.label.toLowerCase()}`}
            />
          ))}
        </View>
      ) : null}

      <Button
        label="Save"
        fullWidth
        size="lg"
        disabled={!form.canSave}
        loading={form.saving}
        onPress={() => void handleSave()}
        accessibilityLabel={
          form.canSave
            ? 'Save transaction'
            : `Save transaction. ${form.problems.map(describeProblem).join(' ')}`
        }
      />

      {showDatePicker ? (
        <DateTimePicker
          value={form.draft.occurredAt}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(_event, date) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (date) {
              form.setOccurredAt(date);
            }
          }}
        />
      ) : null}

      <BottomSheet
        visible={accountSheet !== null}
        onClose={() => setAccountSheet(null)}
        title={accountSheet === 'to' ? 'Transfer to' : 'Account'}
        testID="account-sheet"
      >
        <View style={{ paddingBottom: theme.spacing.lg }}>
          {form.accounts.map((account, index) => (
            <ListItem
              key={account.id}
              title={account.name}
              subtitle={account.type.replace('_', ' ')}
              onPress={() => {
                if (accountSheet === 'to') {
                  form.setToAccount(account.id);
                } else {
                  form.setAccount(account.id);
                }
                setAccountSheet(null);
              }}
              showDivider={index < form.accounts.length - 1}
              accessibilityLabel={`Use ${account.name}`}
            />
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: {
    fontSize: 32,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
