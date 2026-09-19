import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

export type ChipTone = 'neutral' | 'primary' | 'income' | 'expense' | 'warning' | 'info';

export interface ChipProps {
  label: string;
  selected?: boolean;
  tone?: ChipTone;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function Chip({
  label,
  selected = false,
  tone = 'neutral',
  onPress,
  disabled = false,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const { colors } = theme;

  const tones: Record<ChipTone, { fill: string; text: string }> = {
    neutral: { fill: colors.surfaceMuted, text: colors.textSecondary },
    primary: { fill: colors.primarySubtle, text: colors.primary },
    income: { fill: colors.incomeSubtle, text: colors.income },
    expense: { fill: colors.expenseSubtle, text: colors.expense },
    warning: { fill: colors.warningSubtle, text: colors.warning },
    info: { fill: colors.infoSubtle, text: colors.info },
  };

  const active = selected ? tones[tone === 'neutral' ? 'primary' : tone] : tones[tone];
  const content = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: disabled ? colors.disabled : active.fill,
          borderColor: selected ? active.text : 'transparent',
          borderRadius: theme.radius.pill,
          borderWidth: selected ? 1 : StyleSheet.hairlineWidth,
          paddingHorizontal: theme.spacing.md,
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={theme.fontScaleCaps.compact}
        numberOfLines={1}
        style={[theme.typography.label, { color: disabled ? colors.disabledText : active.text }]}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) {
    return (
      <View accessibilityLabel={accessibilityLabel ?? label} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      // The pill is ~32pt tall by design; hitSlop brings the target to 44pt.
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  pressed: {
    opacity: 0.8,
  },
});
