import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export type ProgressTone = 'primary' | 'income' | 'expense' | 'warning' | 'info';

export interface ProgressBarProps {
  /** 0 to 1. Values outside the range are clamped. */
  progress: number;
  tone?: ProgressTone;
  /** Turns amber past 80% and red past 100% - budget behaviour. */
  autoTone?: boolean;
  label?: string;
  height?: number;
  accessibilityLabel?: string;
  testID?: string;
}

export function clampProgress(progress: number): number {
  // NaN means "we don't know" - show an empty bar rather than a full one.
  if (Number.isNaN(progress)) {
    return 0;
  }
  return Math.min(Math.max(progress, 0), 1);
}

export function toneForProgress(progress: number): ProgressTone {
  if (progress >= 1) {
    return 'expense';
  }
  if (progress >= 0.8) {
    return 'warning';
  }
  return 'primary';
}

export function ProgressBar({
  progress,
  tone = 'primary',
  autoTone = false,
  label,
  height = 8,
  accessibilityLabel,
  testID,
}: ProgressBarProps) {
  const theme = useTheme();
  const clamped = clampProgress(progress);
  const effectiveTone = autoTone ? toneForProgress(progress) : tone;
  const percent = Math.round(clamped * 100);

  const fills: Record<ProgressTone, string> = {
    primary: theme.colors.primary,
    income: theme.colors.income,
    expense: theme.colors.expense,
    warning: theme.colors.warning,
    info: theme.colors.info,
  };

  return (
    <View style={{ gap: theme.spacing.xs }} testID={testID}>
      {label ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel ?? label ?? 'Progress'}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={[
          styles.track,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radius.pill,
            height,
          },
        ]}
      >
        <View
          testID={testID ? `${testID}-fill` : undefined}
          style={{
            backgroundColor: fills[effectiveTone],
            borderRadius: theme.radius.pill,
            height,
            width: `${percent}%`,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    width: '100%',
  },
});
