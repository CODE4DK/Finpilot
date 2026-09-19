import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import {
  AmountInput,
  AmountText,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ListItem,
  ProgressRing,
  Screen,
  useToast,
} from '@/components';
import { useAccounts, useGoalContributionsRepository, useGoalsRepository } from '@/db/hooks';
import { formatProjectionDate } from '@/features/goals/projection';
import { useGoal } from '@/features/goals/use-goal';
import { useTheme } from '@/theme';
import { formatINR } from '@/utils/money';

export default function GoalDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { goal, contributions, summary } = useGoal(id);
  const contributionsRepo = useGoalContributionsRepository();
  const goalsRepo = useGoalsRepository();
  const accounts = useAccounts();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [amountPaise, setAmountPaise] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The celebration fires on the transition into completeness, not on every
  // render of an already-finished goal.
  const celebrated = useRef(false);

  useEffect(() => {
    if (!goal || !summary?.isComplete || celebrated.current) {
      return;
    }
    celebrated.current = true;

    toast.show(`${goal.name} reached! 🎉`, { tone: 'success', duration: 6000 });

    if (goal.status !== 'completed' && goalsRepo) {
      void goalsRepo.setStatus(goal.id, 'completed');
    }
  }, [goal, goalsRepo, summary?.isComplete, toast]);

  if (!goal || !summary) {
    return (
      <Screen accessibilityLabel="Goal detail screen">
        <EmptyState
          icon="flag-outline"
          title="Goal not found"
          description="It may have been deleted on another device."
          actionLabel="Back to goals"
          onAction={() => router.replace('/goals')}
        />
      </Screen>
    );
  }

  const addContribution = async () => {
    if (!contributionsRepo || amountPaise === null || amountPaise <= 0) {
      return;
    }
    setSaving(true);
    try {
      await contributionsRepo.insert({
        goal_id: goal.id,
        amount_paise: amountPaise,
        account_id: accountId,
      });
      setSheetOpen(false);
      setAmountPaise(null);
      toast.show('Contribution added', { tone: 'success' });
    } catch {
      toast.show('Could not add the contribution', { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: goal.name }} />
      <Screen accessibilityLabel="Goal detail screen" scrollable>
        <Card accessibilityLabel={`${goal.name} progress`}>
          <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <ProgressRing
              progress={summary.progressFraction}
              tone={summary.isComplete ? 'income' : 'primary'}
              accessibilityLabel={`${summary.progressPercentage}% saved`}
            >
              <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
                {summary.progressPercentage}%
              </Text>
            </ProgressRing>

            <AmountText amountPaise={summary.savedPaise} size="large" />
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              of {formatINR(goal.target_paise, { withDecimals: false })}
              {summary.isComplete
                ? ''
                : ` · ${formatINR(summary.remainingPaise, { withDecimals: false })} to go`}
            </Text>

            {summary.isComplete ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                <Ionicons name="checkmark-circle" size={18} color={theme.colors.income} />
                <Text style={[theme.typography.label, { color: theme.colors.income }]}>
                  Goal reached
                </Text>
              </View>
            ) : null}
          </View>
        </Card>

        {!summary.isComplete ? (
          <Card padded={false}>
            <View style={{ paddingHorizontal: theme.spacing.lg }}>
              {summary.requiredMonthlyPaise !== null ? (
                <ListItem
                  title="Save each month"
                  subtitle={
                    goal.target_date
                      ? `To reach it by ${new Date(goal.target_date).toLocaleDateString('en-IN', {
                          month: 'long',
                          year: 'numeric',
                        })}`
                      : 'To reach your target date'
                  }
                  leading={
                    <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
                  }
                  trailing={<AmountText amountPaise={summary.requiredMonthlyPaise} size="small" />}
                  showDivider
                />
              ) : null}

              <ListItem
                title="Your pace"
                subtitle={
                  summary.averageMonthlyPaise === null
                    ? 'Add a contribution to see your pace'
                    : 'Average per month so far'
                }
                leading={
                  <Ionicons name="trending-up-outline" size={22} color={theme.colors.primary} />
                }
                trailing={
                  summary.averageMonthlyPaise === null ? null : (
                    <AmountText amountPaise={summary.averageMonthlyPaise} size="small" />
                  )
                }
                showDivider={summary.projection !== null}
              />

              {summary.projection ? (
                <ListItem
                  title="On track for"
                  subtitle={
                    summary.projection.behindTarget
                      ? 'Later than your target date at this pace'
                      : 'Estimated from your pace so far'
                  }
                  leading={
                    <Ionicons
                      name="flag-outline"
                      size={22}
                      color={
                        summary.projection.behindTarget ? theme.colors.warning : theme.colors.income
                      }
                    />
                  }
                  trailing={
                    <Text
                      style={[
                        theme.typography.amountSmall,
                        {
                          color: summary.projection.behindTarget
                            ? theme.colors.warning
                            : theme.colors.text,
                        },
                      ]}
                    >
                      {formatProjectionDate(summary.projection.date)}
                    </Text>
                  }
                />
              ) : null}
            </View>
          </Card>
        ) : null}

        <Button
          label="Add contribution"
          fullWidth
          onPress={() => setSheetOpen(true)}
          leading={<Ionicons name="add" size={20} color={theme.colors.onPrimary} />}
        />

        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Contributions</Text>

        {contributions.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="Nothing put aside yet"
            description="Add your first contribution and the projection will start working."
          />
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: theme.spacing.lg }}>
              {contributions.map((contribution, index) => (
                <ListItem
                  key={contribution.id}
                  title={formatINR(contribution.amount_paise)}
                  subtitle={new Date(contribution.contributed_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  leading={
                    <Ionicons
                      name="arrow-up-circle-outline"
                      size={22}
                      color={theme.colors.income}
                    />
                  }
                  showDivider={index < contributions.length - 1}
                />
              ))}
            </View>
          </Card>
        )}

        <BottomSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Add contribution"
          testID="contribution-sheet"
        >
          <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
            <AmountInput
              label="Amount"
              valuePaise={amountPaise}
              onChangePaise={setAmountPaise}
              autoFocus
            />

            <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>
              From an account (optional)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {accounts.data
                .filter((account) => account.is_archived === 0)
                .map((account) => (
                  <Button
                    key={account.id}
                    label={account.name}
                    variant={accountId === account.id ? 'primary' : 'secondary'}
                    size="sm"
                    onPress={() => setAccountId(accountId === account.id ? null : account.id)}
                    accessibilityLabel={`Contribute from ${account.name}`}
                  />
                ))}
            </View>

            <Button
              label="Add"
              fullWidth
              loading={saving}
              disabled={amountPaise === null || amountPaise <= 0}
              onPress={() => void addContribution()}
            />
          </View>
        </BottomSheet>
      </Screen>
    </>
  );
}
