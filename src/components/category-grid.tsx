import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { useTheme } from '@/theme';

export interface CategoryGridItem {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface CategoryGridProps {
  categories: readonly CategoryGridItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** How many of the leading items came from recent usage. */
  recentCount?: number;
  testID?: string;
}

/**
 * The category picker. One tap, so the tiles are large and the recently used
 * ones lead - see src/features/categories/ordering.ts.
 */
export function CategoryGrid({
  categories,
  selectedId,
  onSelect,
  recentCount = 0,
  testID,
}: CategoryGridProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }} testID={testID}>
      {recentCount > 0 ? (
        <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>RECENT</Text>
      ) : null}

      <View style={[styles.grid, { gap: theme.spacing.sm }]}>
        {categories.map((category, index) => {
          const selected = category.id === selectedId;
          const showsAllLabel = recentCount > 0 && index === recentCount;

          return (
            <View key={category.id} style={showsAllLabel ? styles.rowBreak : undefined}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={category.name}
                accessibilityState={{ selected }}
                onPress={() => onSelect(category.id)}
                testID={`category-${category.id}`}
                style={[
                  styles.tile,
                  {
                    backgroundColor: selected ? theme.colors.primarySubtle : theme.colors.surface,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    borderRadius: theme.radius.md,
                    gap: theme.spacing.xs,
                    padding: theme.spacing.sm,
                  },
                ]}
              >
                <CategoryIcon glyph={category.icon} size="sm" color={category.color ?? undefined} />
                <Text
                  maxFontSizeMultiplier={theme.fontScaleCaps.compact}
                  numberOfLines={1}
                  style={[
                    theme.typography.caption,
                    { color: selected ? theme.colors.primary : theme.colors.textSecondary },
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rowBreak: {
    // Keeps the first non-recent tile from looking like part of the recents.
    marginLeft: 0,
  },
  tile: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 76,
    width: 84,
  },
});
