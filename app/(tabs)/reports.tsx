import { Text, View } from 'react-native';

import { AmountText, Card, Chip, EmptyState, Screen } from '@/components';
import { useTheme } from '@/theme';

export default function ReportsScreen() {
  const theme = useTheme();

  return (
    <Screen accessibilityLabel="Reports screen" scrollable>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Chip label="Month" selected onPress={() => {}} />
        <Chip label="Quarter" onPress={() => {}} />
        <Chip label="Year" onPress={() => {}} />
      </View>

      <Card accessibilityLabel="Cash flow summary">
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          Net this month
        </Text>
        <AmountText amountPaise={5254400} size="large" colorBySign />
      </Card>

      <EmptyState
        icon="bar-chart-outline"
        title="Charts land in Phase 5"
        description="Spending by category, trends over time and cash-flow charts will render here with Victory Native."
      />
    </Screen>
  );
}
