import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import {
  AmountText,
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  ProgressBar,
  Screen,
} from '@/components';
import { useGoals } from '@/db/hooks';
import { progressPercentage } from '@/features/goals/projection';
import { useTheme } from '@/theme';
import { formatINR } from '@/utils/money';

export default function GoalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: goals } = useGoals();

  if (goals.length === 0) {
    return (
      <Screen accessibilityLabel="Goals screen">
        <EmptyState
          icon="flag-outline"
          title="No goals yet"
          description="An emergency fund, a trip, a new laptop — name what you're saving for and track it here."
          actionLabel="Create a goal"
          onAction={() => router.push('/goals/new')}
        />
      </Screen>
    );
  }

  return (
    <Screen accessibilityLabel="Goals screen" scrollable>
      {goals.map((goal) => {
        const percentage = progressPercentage(goal.target_paise, goal.saved_paise);
        const complete = goal.status === 'completed' || goal.saved_paise >= goal.target_paise;

        return (
          <Card
            key={goal.id}
            accessibilityLabel={`${goal.name}, ${percentage}% saved`}
            onPress={() => router.push(`/goals/${goal.id}`)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <CategoryIcon
                glyph={goal.icon ?? 'flag-outline'}
                color={complete ? theme.colors.income : undefined}
              />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
                    {goal.name}
                  </Text>
                  {complete ? (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.income} />
                  ) : (
                    <AmountText amountPaise={goal.saved_paise} size="small" />
                  )}
                </View>

                <ProgressBar
                  progress={goal.saved_paise / Math.max(goal.target_paise, 1)}
                  tone={complete ? 'income' : 'primary'}
                  accessibilityLabel={`${goal.name} progress`}
                />

                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                  {complete
                    ? 'Reached'
                    : `${percentage}% of ${formatINR(goal.target_paise, { withDecimals: false })}`}
                </Text>
              </View>
            </View>
          </Card>
        );
      })}

      <Button
        label="Create a goal"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/goals/new')}
        leading={<Ionicons name="add" size={20} color={theme.colors.text} />}
      />
    </Screen>
  );
}
