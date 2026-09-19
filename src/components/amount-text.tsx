import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme';
import { formatINR, type FormatInrOptions } from '@/utils/money';

export interface AmountTextProps extends Omit<TextProps, 'children'> {
  /** Integer paise - never a float. */
  amountPaise: number;
  /** Colour income green and expenses red. */
  colorBySign?: boolean;
  /** Type scale variant to use. */
  size?: 'large' | 'medium' | 'small';
  formatOptions?: FormatInrOptions;
}

export function AmountText({
  amountPaise,
  colorBySign = false,
  size = 'medium',
  formatOptions,
  style,
  ...rest
}: AmountTextProps) {
  const theme = useTheme();
  const formatted = formatINR(amountPaise, formatOptions);

  const variants = {
    large: theme.typography.amountLarge,
    medium: theme.typography.amount,
    small: theme.typography.amountSmall,
  } as const;

  const signColor = amountPaise < 0 ? theme.colors.expense : theme.colors.income;

  return (
    <Text
      accessibilityLabel={formatted}
      maxFontSizeMultiplier={theme.fontScaleCaps.control}
      style={[variants[size], { color: colorBySign ? signColor : theme.colors.text }, style]}
      {...rest}
    >
      {formatted}
    </Text>
  );
}
