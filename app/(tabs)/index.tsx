import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AmountText, Button, Card, EmptyState, Screen, TransactionRow } from '@/components';
import { useSyncSummary, useTransactionTotals } from '@/db/hooks';
import {
  InsightCard,
  resolveInsight,
  useRuleBasedInsight,
  useStoredInsight,
} from '@/features/insights';
import { useAccountsWithBalances } from '@/features/accounts';
import { monthPeriod } from '@/features/ledger/period';
import { SyncIndicator, SyncStatusSheet } from '@/features/sync';
import { useTransactionList } from '@/features/transactions/use-transaction-list';
import { selectPrivacyMode, useSettingsStore } from '@/stores/settings-store';
import { useTheme } from '@/theme';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const privacyMode = useSettingsStore(selectPrivacyMode);
  const togglePrivacyMode = useSettingsStore((state) => state.togglePrivacyMode);
  const syncSummary = useSyncSummary();
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);

  const period = useMemo(() => monthPeriod(new Date()), []);
  const totals = useTransactionTotals(period.from, period.to);
  const { netWorth } = useAccountsWithBalances();
  const { rows } = useTransactionList({ limit: 5 });

  // Always something to show: the AI insight when there is one for the month,
  // the on-device rules otherwise - and the card says which it is.
  const storedInsight = useStoredInsight();
  const ruleInsight = useRuleBasedInsight();
  const insight = resolveInsight(storedInsight, ruleInsight);

  const monthTotals = totals.data[0] ?? { income_paise: 0, expense_paise: 0 };
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });

  return (
    <Screen accessibilityLabel="Home screen" scrollable>
      <View style={styles.headerRow}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>FinPilot</Text>
        <View style={[styles.headerActions, { gap: theme.spacing.sm }]}>
          <SyncIndicator summary={syncSummary} onPress={() => setSyncSheetOpen(true)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={privacyMode ? 'Show amounts' : 'Hide amounts'}
            accessibilityState={{ selected: privacyMode }}
            hitSlop={12}
            onPress={togglePrivacyMode}
            style={styles.iconButton}
          >
            <Ionicons
              name={privacyMode ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={theme.colors.textSecondary}
            />
          </Pressable>
          <Link href="/settings" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              hitSlop={12}
              style={styles.iconButton}
            >
              <Ionicons name="settings-outline" size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </Link>
        </View>
      </View>

      <Card accessibilityLabel="Balance summary" onPress={() => router.push('/accounts')}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Net worth</Text>
        {privacyMode ? (
          <Text
            accessibilityLabel="Balance hidden by privacy mode"
            style={[theme.typography.amountLarge, { color: theme.colors.text }]}
          >
            ••••••
          </Text>
        ) : (
          <AmountText amountPaise={netWorth.totalPaise} size="large" />
        )}

        <View style={[styles.summaryRow, { gap: theme.spacing.xl, marginTop: theme.spacing.md }]}>
          <View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              {monthName} income
            </Text>
            {privacyMode ? (
              <Text style={[theme.typography.amountSmall, { color: theme.colors.text }]}>•••</Text>
            ) : (
              <AmountText amountPaise={monthTotals.income_paise} size="small" colorBySign />
            )}
          </View>
          <View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              {monthName} spend
            </Text>
            {privacyMode ? (
              <Text style={[theme.typography.amountSmall, { color: theme.colors.text }]}>•••</Text>
            ) : (
              <AmountText amountPaise={-monthTotals.expense_paise} size="small" colorBySign />
            )}
          </View>
        </View>
      </Card>

      <InsightCard
        insight={insight}
        onPress={() => router.push('/insights')}
        testID="home-insight-card"
      />

      <Button
        label="Add transaction"
        fullWidth
        onPress={() => router.push('/(tabs)/add')}
        leading={<Ionicons name="add" size={20} color={theme.colors.onPrimary} />}
      />

      <View style={styles.headerRow}>
        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Recent</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all transactions"
          hitSlop={12}
          onPress={() => router.push('/(tabs)/transactions')}
          style={{ minHeight: theme.minTouchTarget, justifyContent: 'center' }}
        >
          <Text style={[theme.typography.label, { color: theme.colors.primary }]}>See all</Text>
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No transactions yet"
          description="Add your first one and it will show up here."
          actionLabel="Add transaction"
          onAction={() => router.push('/(tabs)/add')}
        />
      ) : (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            {rows.slice(0, 5).map((transaction, index) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                onPress={() => router.push(`/transactions/${transaction.id}`)}
                showDivider={index < Math.min(rows.length, 5) - 1}
              />
            ))}
          </View>
        </Card>
      )}

      <SyncStatusSheet
        visible={syncSheetOpen}
        onClose={() => setSyncSheetOpen(false)}
        summary={syncSummary}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  summaryRow: {
    flexDirection: 'row',
  },
});
