import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, CategoryIcon, Chip, ListItem, Screen, SwipeRow, useToast } from '@/components';
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

  /**
   * Hoisted out of the list so FlashList gets a stable function rather than a
   * new closure on every render - which is what lets it recycle rows instead
   * of re-rendering the visible window. A user with a long tail of custom
   * categories notices the difference; the seventeen defaults do not.
   */
  const renderItem = useCallback(
    ({ item, index }: { item: (typeof data)[number]; index: number }) => (
      <SwipeRow
        testID={`swipe-category-${item.id}`}
        rightActions={[
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'expense',
            onPress: () => void remove(item),
          },
        ]}
      >
        <ListItem
          title={item.name}
          subtitle={item.is_default === 1 ? 'Built-in' : 'Custom'}
          leading={<CategoryIcon glyph={item.icon} color={item.color ?? undefined} />}
          trailing={<Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />}
          onPress={() => router.push(`/categories/${item.id}`)}
          showDivider={index < data.length - 1}
        />
      </SwipeRow>
    ),
    // `remove` closes over the repository and the toast, both stable enough
    // for the lifetime of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.length, router, theme.colors.textMuted],
  );

  return (
    <Screen accessibilityLabel="Categories screen" padded={false}>
      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
        }}
      >
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

      <View style={{ flex: 1 }}>
        <FlashList
          data={data}
          renderItem={renderItem}
          keyExtractor={(category) => category.id}
          testID="category-list"
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg }}
        />
      </View>

      <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
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
      </View>
    </Screen>
  );
}
