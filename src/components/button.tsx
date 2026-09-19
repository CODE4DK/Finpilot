import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Rendered before the label - an icon, usually. */
  leading?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Defaults to the label; override when the label alone is ambiguous. */
  accessibilityLabel?: string;
}

const HEIGHTS: Record<ButtonSize, number> = { sm: 44, md: 48, lg: 56 };

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leading,
  fullWidth = false,
  style,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const { colors } = theme;
  const isInactive = disabled || loading;

  const background: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.surfaceMuted,
    tertiary: 'transparent',
    destructive: colors.expense,
  };
  const foreground: Record<ButtonVariant, string> = {
    primary: colors.onPrimary,
    secondary: colors.text,
    tertiary: colors.primary,
    destructive: colors.onSemantic,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: HEIGHTS[size],
          borderRadius: theme.radius.md,
          paddingHorizontal: size === 'sm' ? theme.spacing.md : theme.spacing.lg,
          backgroundColor: isInactive ? colors.disabled : background[variant],
          borderWidth: variant === 'tertiary' ? 0 : StyleSheet.hairlineWidth,
          borderColor: variant === 'secondary' ? colors.border : 'transparent',
          opacity: pressed && !isInactive ? 0.85 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...rest}
    >
      <View style={[styles.content, { gap: theme.spacing.sm }]}>
        {loading ? (
          <ActivityIndicator
            accessibilityElementsHidden
            importantForAccessibility="no"
            color={isInactive ? colors.disabledText : foreground[variant]}
            size="small"
          />
        ) : (
          leading
        )}
        <Text
          maxFontSizeMultiplier={theme.fontScaleCaps.control}
          numberOfLines={1}
          style={[
            theme.typography.bodyStrong,
            { color: isInactive ? colors.disabledText : foreground[variant] },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});
