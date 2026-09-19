import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, Screen, TextInput, useToast } from '@/components';
import { useCategoriesRepository } from '@/db/hooks';
import { useTheme } from '@/theme';
import type { CategoryType } from '@/db/enums';

/** The glyphs a user can pick from when naming their own category. */
export const CATEGORY_GLYPH_CHOICES = [
  'restaurant-outline',
  'cart-outline',
  'home-outline',
  'bus-outline',
  'car-outline',
  'bag-handle-outline',
  'receipt-outline',
  'card-outline',
  'medkit-outline',
  'school-outline',
  'game-controller-outline',
  'airplane-outline',
  'wallet-outline',
  'gift-outline',
  'trending-up-outline',
  'ellipsis-horizontal-outline',
] as const;

export interface CategoryFormScreenProps {
  categoryId?: string;
  initialName?: string;
  initialType?: CategoryType;
  initialIcon?: string | null;
  isDefault?: boolean;
  title: string;
  accessibilityLabel: string;
}

export function CategoryFormScreen({
  categoryId,
  initialName = '',
  initialType = 'expense',
  initialIcon = null,
  isDefault = false,
  title,
  accessibilityLabel,
}: CategoryFormScreenProps) {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const repository = useCategoriesRepository();

  const [name, setName] = useState(initialName);
  const [type, setType] = useState<CategoryType>(initialType);
  const [icon, setIcon] = useState<string | null>(initialIcon);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= 60;

  const save = async () => {
    if (!repository || !canSave) {
      return;
    }
    setSaving(true);
    try {
      const values = {
        name: trimmed,
        type,
        icon: icon ?? 'ellipsis-horizontal-outline',
      };
      if (categoryId) {
        await repository.update(categoryId, values);
      } else {
        await repository.insert(values);
      }
      toast.show(categoryId ? 'Category updated' : 'Category added', { tone: 'success' });
      router.back();
    } catch {
      toast.show('Could not save the category', { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen accessibilityLabel={accessibilityLabel} scrollable>
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>{title}</Text>

      <TextInput
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Chai"
        autoCapitalize="words"
        autoFocus={!categoryId}
        maxLength={60}
      />

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>Type</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Chip
            label="Expense"
            selected={type === 'expense'}
            // A built-in category's type is fixed: changing it would strand
            // every transaction already filed under it.
            disabled={isDefault}
            onPress={() => setType('expense')}
            accessibilityLabel="Expense category"
          />
          <Chip
            label="Income"
            selected={type === 'income'}
            disabled={isDefault}
            onPress={() => setType('income')}
            accessibilityLabel="Income category"
          />
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>Icon</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {CATEGORY_GLYPH_CHOICES.map((glyph) => (
            <Chip
              key={glyph}
              label={glyph.replace('-outline', '').replace(/-/g, ' ')}
              selected={icon === glyph}
              onPress={() => setIcon(glyph)}
              accessibilityLabel={`Use the ${glyph.replace('-outline', '')} icon`}
            />
          ))}
        </View>
      </View>

      <Button
        label={categoryId ? 'Save changes' : 'Add category'}
        fullWidth
        loading={saving}
        disabled={!canSave}
        onPress={() => void save()}
      />
    </Screen>
  );
}
