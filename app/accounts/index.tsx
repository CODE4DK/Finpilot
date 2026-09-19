import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AmountText, Button, Card, CategoryIcon, EmptyState, ListItem, Screen } from '@/components';
import { useAccountsWithBalances } from '@/features/accounts/use-accounts-with-balances';
import { useTheme } from '@/theme';
import { formatINR } from '@/utils/money';

const TYPE_GLYPHS: Record<string, string> = {
  cash: 'cash-outline',
  bank: 'business-outline',
  card: 'card-outline',
  upi_wallet: 'phone-portrait-outline',
};

const TYPE_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  card: 'Credit card',
  upi_wallet: 'UPI wallet',
};

export default function AccountsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { accounts, netWorth, isLoading } = useAccountsWithBalances();

  return (
    <Screen accessibilityLabel="Accounts screen" scrollable>
      <Card accessibilityLabel="Net worth">
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Net worth</Text>
        <AmountText amountPaise={netWorth.totalPaise} size="large" />
        <View style={[styles.summaryRow, { gap: theme.spacing.xl, marginTop: theme.spacing.md }]}>
          <View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              You have
            </Text>
            <Text style={[theme.typography.amountSmall, { color: theme.colors.income }]}>
              {formatINR(netWorth.assetsPaise, { withDecimals: false })}
            </Text>
          </View>
          <View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              You owe
            </Text>
            <Text style={[theme.typography.amountSmall, { color: theme.colors.expense }]}>
              {formatINR(netWorth.liabilitiesPaise, { withDecimals: false })}
            </Text>
          </View>
        </View>
      </Card>

      {accounts.length === 0 && !isLoading ? (
        <EmptyState
          icon="wallet-outline"
          title="No accounts yet"
          description="Add the account most of your money sits in to get started."
          actionLabel="Add account"
          onAction={() => router.push('/accounts/new')}
        />
      ) : (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            {accounts.map((account, index) => (
              <ListItem
                key={account.id}
                title={account.name}
                subtitle={`${TYPE_LABELS[account.type] ?? account.type}${
                  account.is_archived === 1 ? ' · Archived' : ''
                }`}
                leading={
                  <CategoryIcon
                    glyph={account.icon ?? TYPE_GLYPHS[account.type]}
                    color={account.color ?? undefined}
                  />
                }
                trailing={
                  <AmountText amountPaise={account.balance_paise} size="small" colorBySign />
                }
                onPress={() => router.push(`/accounts/${account.id}`)}
                accessibilityLabel={`${account.name}, balance ${formatINR(account.balance_paise)}`}
                showDivider={index < accounts.length - 1}
              />
            ))}
          </View>
        </Card>
      )}

      <Button
        label="Add account"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/accounts/new')}
        leading={<Ionicons name="add" size={20} color={theme.colors.text} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
  },
});
