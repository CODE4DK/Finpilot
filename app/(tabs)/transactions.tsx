import { useState } from 'react';
import { View } from 'react-native';

import { Card, Chip, EmptyState, Screen, SkeletonList } from '@/components';
import { useTheme } from '@/theme';

const FILTERS = ['All', 'Income', 'Expense', 'Transfers'] as const;

export default function TransactionsScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  // Phase 1 has no data layer yet; the loading shape is here so Phase 2 only
  // has to swap the source.
  const [loading] = useState(false);

  return (
    <Screen accessibilityLabel="Transactions screen" scrollable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {FILTERS.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={filter === option}
            onPress={() => setFilter(option)}
            accessibilityLabel={`Filter by ${option}`}
          />
        ))}
      </View>

      {loading ? (
        <Card>
          <SkeletonList rows={4} />
        </Card>
      ) : (
        <EmptyState
          icon="receipt-outline"
          title="No transactions yet"
          description="Once you add your first transaction it will show up here, grouped by day."
          actionLabel="Add transaction"
          onAction={() => {}}
        />
      )}
    </Screen>
  );
}
