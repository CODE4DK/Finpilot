import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/** The Phase 1 starter set; the full taxonomy arrives with the data model. */
export const CATEGORY_ICONS = {
  food: 'restaurant-outline',
  groceries: 'cart-outline',
  transport: 'bus-outline',
  fuel: 'car-outline',
  rent: 'home-outline',
  bills: 'receipt-outline',
  shopping: 'bag-handle-outline',
  health: 'medkit-outline',
  education: 'school-outline',
  entertainment: 'game-controller-outline',
  travel: 'airplane-outline',
  investment: 'trending-up-outline',
  salary: 'wallet-outline',
  gift: 'gift-outline',
  transfer: 'swap-horizontal-outline',
  other: 'ellipsis-horizontal-outline',
} as const;

export type CategoryKey = keyof typeof CATEGORY_ICONS;

export type CategoryIconSize = 'sm' | 'md' | 'lg';

const SIZES: Record<CategoryIconSize, { container: number; glyph: number }> = {
  sm: { container: 32, glyph: 16 },
  md: { container: 40, glyph: 20 },
  lg: { container: 48, glyph: 24 },
};

export interface CategoryIconProps {
  category: CategoryKey;
  size?: CategoryIconSize;
  /** Tint, e.g. income green for a salary row. Defaults to the brand teal. */
  color?: string;
  backgroundColor?: string;
  /** Decorative by default - the row's label already names the category. */
  accessibilityLabel?: string;
  testID?: string;
}

export function CategoryIcon({
  category,
  size = 'md',
  color,
  backgroundColor,
  accessibilityLabel,
  testID,
}: CategoryIconProps) {
  const theme = useTheme();
  const { container, glyph } = SIZES[size];
  const decorative = accessibilityLabel === undefined;

  return (
    <View
      accessible={!decorative}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={decorative ? undefined : 'image'}
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: backgroundColor ?? theme.colors.primarySubtle,
          borderRadius: theme.radius.md,
          height: container,
          width: container,
        },
      ]}
    >
      <Ionicons
        name={CATEGORY_ICONS[category]}
        size={glyph}
        color={color ?? theme.colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
