import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Tint for the selected state; defaults to the brand colour. */
  tone?: 'primary' | 'income' | 'expense';
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  testID?: string;
}

/** The expense / income / transfer switch at the top of the Add screen. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  const tones = {
    primary: theme.colors.primary,
    income: theme.colors.income,
    expense: theme.colors.expense,
  } as const;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.track,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.md,
          padding: theme.spacing.xxs,
        },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const tint = tones[option.tone ?? 'primary'];

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            testID={testID ? `${testID}-${option.value}` : undefined}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? theme.colors.surface : 'transparent',
                borderRadius: theme.radius.sm,
                minHeight: theme.minTouchTarget,
              },
              selected && theme.elevation(1),
            ]}
          >
            <Text
              maxFontSizeMultiplier={theme.fontScaleCaps.control}
              numberOfLines={1}
              style={[
                theme.typography.label,
                { color: selected ? tint : theme.colors.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  track: {
    flexDirection: 'row',
  },
});
