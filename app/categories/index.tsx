import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  Card,
  CategoryIcon,
  Chip,
  ListItem,
  Screen,
  SwipeRow,
  useToast,
} from '@/components';
import { useCategories, useCategoriesRepository } from '@/db/hooks';
import { canDeleteCategory, describeDeleteBlock } from '@/features/categories/ordering';
import { useTheme } from '@/theme';
import type { CategoryType } from '@/db/enums';

export default function CategoriesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const repository = useCategoriesRepository();
  const [type, setType] = useState<CategoryType>('expense');
  const { data } = useCategories(type);

  const remove = async (category: (typeof data)[number]) => {
    if (!repository) {
      return;
    }

    // Seeded defaults are archived, never deleted: a user's past transactions
    // and muscle memory both depend on them existing.
    if (!canDeleteCategory(category)) {
      toast.show(describeDeleteBlock(category) ?? 'This category cannot be deleted', {
        tone: 'warning',
      });
      return;
    }

    await repository.remove(category.id);
    toast.show('Category deleted', {
      tone: 'info',
      action: {
        label: 'Undo',
        onPress: () => {
          void repository.insert({
            id: category.id,
            name: category.name,
            type: category.type as CategoryType,
            icon: category.icon,
            color: category.color,
            is_default: category.is_default,
            parent_id: category.parent_id,
          });
        },
      },
    });
  };

  return (
    <Screen accessibilityLabel="Categories screen" scrollable>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Chip
          label="Expense"
          selected={type === 'expense'}
          onPress={() => setType('expense')}
          accessibilityLabel="Show expense categories"
        />
        <Chip
          label="Income"
          selected={type === 'income'}
          onPress={() => setType('income')}
          accessibilityLabel="Show income categories"
        />
      </View>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          {data.map((category, index) => (
            <SwipeRow
              key={category.id}
              testID={`swipe-category-${category.id}`}
              rightActions={[
                {
                  label: 'Delete',
                  icon: 'trash-outline',
                  tone: 'expense',
                  onPress: () => void remove(category),
                },
              ]}
            >
              <ListItem
                title={category.name}
                subtitle={category.is_default === 1 ? 'Built-in' : 'Custom'}
                leading={<CategoryIcon glyph={category.icon} color={category.color ?? undefined} />}
                trailing={
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                }
                onPress={() => router.push(`/categories/${category.id}`)}
                showDivider={index < data.length - 1}
              />
            </SwipeRow>
          ))}
        </View>
      </Card>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        Built-in categories can be renamed or archived, but not deleted — past transactions still
        point at them.
      </Text>

      <Button
        label="Add category"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/categories/new')}
        leading={<Ionicons name="add" size={20} color={theme.colors.text} />}
      />
    </Screen>
  );
}
