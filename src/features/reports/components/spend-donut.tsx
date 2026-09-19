import { Pie, PolarChart } from 'victory-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';
import { formatINR, paiseToRupees } from '@/utils/money';

import type { CategorySlice } from '../aggregate';

export interface SpendDonutProps {
  slices: readonly CategorySlice[];
  totalPaise: number;
  /** The spoken sentence; the canvas itself says nothing to a screen reader. */
  summary: string;
  size?: number;
  testID?: string;
}

/**
 * Spending by category.
 *
 * The chart is one accessibility node carrying the summary - the slices are
 * Skia paths, so exposing them individually would announce a list of shapes.
 * The ranked list beside it is the interactive, per-category surface, and it
 * is also what keeps identity off colour alone.
 */
export function SpendDonut({ slices, totalPaise, summary, size = 200, testID }: SpendDonutProps) {
  const theme = useTheme();

  const data = slices.map((slice) => ({
    label: slice.name,
    // Rupees, not paise: this is chart geometry, never an amount we store.
    value: paiseToRupees(slice.amountPaise),
    color: slice.color,
  }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      style={[styles.wrapper, { height: size }]}
      testID={testID}
    >
      <View style={{ width: size, height: size }}>
        <PolarChart data={data} labelKey="label" valueKey="value" colorKey="color">
          <Pie.Chart innerRadius="64%">
            {() => (
              <Pie.Slice>
                {/* A ring of surface between slices, so neighbours never merge. */}
                <Pie.SliceAngularInset
                  angularInset={{ angularStrokeWidth: 2, angularStrokeColor: theme.colors.surface }}
                />
              </Pie.Slice>
            )}
          </Pie.Chart>
        </PolarChart>
      </View>

      {/* The hole is wasted space otherwise, and the total is the one number
          every category is a share of. */}
      <View
        style={styles.centre}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          style={[theme.typography.caption, { color: theme.colors.textMuted }]}
          maxFontSizeMultiplier={theme.fontScaleCaps.control}
        >
          Total spend
        </Text>
        <Text
          style={[theme.typography.bodyStrong, { color: theme.colors.text }]}
          maxFontSizeMultiplier={theme.fontScaleCaps.control}
          numberOfLines={1}
        >
          {formatINR(totalPaise, { withDecimals: false, compact: totalPaise >= 1_00_000_00 })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  centre: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
