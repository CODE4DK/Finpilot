import { useState } from 'react';
import { View } from 'react-native';

import { AmountInput, Button, Chip, Screen, TextInput, useToast } from '@/components';
import type { CategoryKey } from '@/components/category-icon';
import { useTheme } from '@/theme';

const QUICK_CATEGORIES = ['food', 'groceries', 'transport', 'bills', 'shopping'] as const;

export default function AddTransactionScreen() {
  const theme = useTheme();
  const toast = useToast();
  const [amountPaise, setAmountPaise] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<CategoryKey>('food');

  const canSave = amountPaise !== null && amountPaise !== 0;

  return (
    <Screen accessibilityLabel="Add transaction screen" scrollable>
      <AmountInput
        label="Amount"
        valuePaise={amountPaise}
        onChangePaise={setAmountPaise}
        autoFocus
      />

      <TextInput
        label="Note"
        placeholder="What was it for?"
        value={note}
        onChangeText={setNote}
        maxLength={120}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {QUICK_CATEGORIES.map((key) => (
          <Chip
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            selected={category === key}
            onPress={() => setCategory(key)}
            accessibilityLabel={`Category ${key}`}
          />
        ))}
      </View>

      <Button
        label="Save transaction"
        fullWidth
        disabled={!canSave}
        onPress={() =>
          toast.show('Saving arrives with the data layer in Phase 2', { tone: 'info' })
        }
        accessibilityLabel={
          canSave ? 'Save transaction' : 'Save transaction, enter an amount first'
        }
      />
    </Screen>
  );
}
