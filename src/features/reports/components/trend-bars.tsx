import { BarGroup, CartesianChart } from 'victory-native';
import { StyleSheet, Text, View } from 'react-native';

import { trendSeries, useTheme } from '@/theme';
import { formatINR, paiseToRupees } from '@/utils/money';

import type { TrendPoint } from '../aggregate';

export interface TrendBarsProps {
  points: readonly TrendPoint[];
  summary: string;
  height?: number;
  testID?: string;
}

/**
 * Income against expense, one pair of bars per month.
 *
 * The bars carry blue and orange rather than the app's income green and
 * expense red: that green/red pair collapses to a single colour under
 * deuteranopia (see `src/theme/chart-colors.ts`). The legend and the month
 * labels are ordinary React Native text below the canvas - which keeps them
 * font-scalable and readable, and saves bundling a Skia font just for an axis.
 */
export function TrendBars({ points, summary, height = 200, testID }: TrendBarsProps) {
  const theme = useTheme();
  const series = trendSeries(theme.scheme);

  const data = points.map((point, index) => ({
    index,
    // Rupees for geometry only; every stored and displayed value stays paise.
    income: paiseToRupees(point.incomePaise),
    expense: paiseToRupees(point.expensePaise),
  }));

  const peakPaise = points.reduce(
    (peak, point) => Math.max(peak, point.incomePaise, point.expensePaise),
    0,
  );

  return (
    <View testID={testID}>
      <View style={styles.legend}>
        <LegendSwatch color={series.income} label="Money in" />
        <LegendSwatch color={series.expense} label="Money out" />
        <Text
          style={[theme.typography.caption, { color: theme.colors.textMuted, marginLeft: 'auto' }]}
          maxFontSizeMultiplier={theme.fontScaleCaps.control}
        >
          peak {formatINR(peakPaise, { withDecimals: false, compact: true })}
        </Text>
      </View>

      <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ height }}>
        <CartesianChart
          data={data}
          xKey="index"
          yKeys={['income', 'expense']}
          domainPadding={{ left: 24, right: 24, top: 12 }}
          domain={{ y: [0, Math.max(paiseToRupees(peakPaise), 1)] }}
        >
          {({ points: chartPoints, chartBounds }) => (
            <BarGroup
              chartBounds={chartBounds}
              betweenGroupPadding={0.35}
              withinGroupPadding={0.15}
              roundedCorners={{ topLeft: 4, topRight: 4 }}
            >
              <BarGroup.Bar points={chartPoints.income} color={series.income} />
              <BarGroup.Bar points={chartPoints.expense} color={series.expense} />
            </BarGroup>
          )}
        </CartesianChart>
      </View>

      <View style={styles.axis} importantForAccessibility="no-hide-descendants">
        {points.map((point) => (
          <Text
            key={point.monthKey}
            numberOfLines={1}
            style={[theme.typography.caption, styles.axisLabel, { color: theme.colors.textMuted }]}
            maxFontSizeMultiplier={theme.fontScaleCaps.control}
          >
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text
        style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
        maxFontSizeMultiplier={theme.fontScaleCaps.control}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  axis: { flexDirection: 'row', marginTop: 4 },
  axisLabel: { flex: 1, textAlign: 'center' },
});
