import { Text, type TextProps, useColorScheme } from 'react-native';

import { formatPaise, type FormatPaiseOptions } from '@/utils/money';
import { darkColors, lightColors, typography } from '@/theme';

interface AmountTextProps extends Omit<TextProps, 'children'> {
  /** Integer paise - never a float. */
  amountPaise: number;
  /** Colours income green and expenses red. */
  colorBySign?: boolean;
  formatOptions?: FormatPaiseOptions;
}

export function AmountText({
  amountPaise,
  colorBySign = false,
  formatOptions,
  style,
  ...rest
}: AmountTextProps) {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const formatted = formatPaise(amountPaise, formatOptions);

  const signColor = amountPaise < 0 ? colors.expense : colors.income;

  return (
    <Text
      accessibilityLabel={formatted}
      style={[typography.amount, { color: colorBySign ? signColor : colors.text }, style]}
      {...rest}
    >
      {formatted}
    </Text>
  );
}
