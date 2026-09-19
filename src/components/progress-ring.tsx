import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { clampProgress, type ProgressTone } from '@/components/progress-bar';
import { useTheme } from '@/theme';

export interface ProgressRingProps {
  /** 0 to 1. Clamped. */
  progress: number;
  size?: number;
  thickness?: number;
  tone?: ProgressTone;
  /** Rendered in the middle - usually an amount or a percentage. */
  children?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
}

/** Circumference maths kept separate so it can be unit tested. */
export function describeRing(size: number, thickness: number, progress: number) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = clampProgress(progress);
  return {
    radius,
    circumference,
    dashOffset: circumference * (1 - clamped),
    percent: Math.round(clamped * 100),
  };
}

export function ProgressRing({
  progress,
  size = 120,
  thickness = 10,
  tone = 'primary',
  children,
  accessibilityLabel,
  testID,
}: ProgressRingProps) {
  const theme = useTheme();
  const { radius, circumference, dashOffset, percent } = describeRing(size, thickness, progress);

  const fills: Record<ProgressTone, string> = {
    primary: theme.colors.primary,
    income: theme.colors.income,
    expense: theme.colors.expense,
    warning: theme.colors.warning,
    info: theme.colors.info,
  };

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? 'Progress'}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      testID={testID}
      style={[styles.container, { height: size, width: size }]}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.surfaceMuted}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={fills[tone]}
          strokeWidth={thickness}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          fill="none"
          // Start the sweep at 12 o'clock rather than 3 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
