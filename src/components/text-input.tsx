import { forwardRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
  type StyleProp,
  type TextInputProps as RNTextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme';

export interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label: string;
  /** Helper copy under the field; replaced by `error` when one is present. */
  hint?: string;
  error?: string;
  /** Hide the visible label but keep it for screen readers. */
  labelHidden?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<ViewStyle>;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  {
    label,
    hint,
    error,
    labelHidden = false,
    leading,
    trailing,
    containerStyle,
    inputStyle,
    onFocus,
    onBlur,
    accessibilityLabel,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const { colors } = theme;
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.expense : focused ? colors.focus : colors.border;

  return (
    <View style={[{ gap: theme.spacing.xs }, containerStyle]}>
      {!labelHidden && (
        <Text style={[theme.typography.label, { color: colors.textSecondary }]}>{label}</Text>
      )}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor,
            borderRadius: theme.radius.md,
            borderWidth: focused || error ? 2 : StyleSheet.hairlineWidth,
            gap: theme.spacing.sm,
            minHeight: theme.minTouchTarget,
            paddingHorizontal: theme.spacing.md,
          },
        ]}
      >
        {leading}
        <RNTextInput
          ref={ref}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.textMuted}
          maxFontSizeMultiplier={theme.fontScaleCaps.control}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, theme.typography.body, { color: colors.text }, inputStyle]}
          {...rest}
        />
        {trailing}
      </View>
      {(error ?? hint) && (
        <Text
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={[theme.typography.caption, { color: error ? colors.expense : colors.textMuted }]}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    paddingVertical: 10,
  },
});
