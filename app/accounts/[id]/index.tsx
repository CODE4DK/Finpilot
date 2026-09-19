import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import {
  AmountText,
  Button,
  Card,
  EmptyState,
  Screen,
  TransactionRow,
  useToast,
} from '@/components';
import { useAccountsRepository } from '@/db/hooks';
import { useAccountsWithBalances } from '@/features/accounts';
import { useTransactionList } from '@/features/transactions/use-transaction-list';
import { useTheme } from '@/theme';

export default function AccountDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts } = useAccountsWithBalances();
  const repository = useAccountsRepository();

  const account = accounts.find((candidate) => candidate.id === id);
  const { rows } = useTransactionList({ accountIds: id ? [id] : [], limit: 100 });

  const toggleArchived = async () => {
    if (!repository || !account) {
      return;
    }
    const archiving = account.is_archived === 0;
    await repository.setArchived(account.id, archiving);
    toast.show(archiving ? 'Account archived' : 'Account restored', { tone: 'success' });
  };

  if (!account) {
    return (
      <Screen accessibilityLabel="Account detail screen">
        <EmptyState
          icon="wallet-outline"
          title="Account not found"
          description="It may have been deleted on another device."
          actionLabel="Back to accounts"
          onAction={() => router.replace('/accounts')}
        />
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: account.name }} />
      <Screen accessibilityLabel="Account detail screen" scrollable>
        <Card accessibilityLabel={`${account.name} balance`}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            Current balance
          </Text>
          <AmountText amountPaise={account.balance_paise} size="large" colorBySign />
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
            ]}
          >
            Opened with {account.opening_balance_paise >= 0 ? '' : '−'}
            {Math.abs(account.opening_balance_paise / 100).toLocaleString('en-IN')} rupees
          </Text>
        </Card>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            label="Edit"
            variant="secondary"
            onPress={() => router.push(`/accounts/${account.id}/edit`)}
            leading={<Ionicons name="create-outline" size={18} color={theme.colors.text} />}
            style={{ flex: 1 }}
          />
          <Button
            label={account.is_archived === 1 ? 'Restore' : 'Archive'}
            variant="secondary"
            onPress={() => void toggleArchived()}
            leading={<Ionicons name="archive-outline" size={18} color={theme.colors.text} />}
            style={{ flex: 1 }}
          />
        </View>

        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Transactions</Text>

        {rows.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="Nothing here yet"
            description="Transactions on this account will appear here."
          />
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: theme.spacing.lg }}>
              {rows.map((transaction, index) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onPress={() => router.push(`/transactions/${transaction.id}`)}
                  showDivider={index < rows.length - 1}
                />
              ))}
            </View>
          </Card>
        )}
      </Screen>
    </>
  );
}
