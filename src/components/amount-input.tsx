import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TextInput, type TextInputProps } from '@/components/text-input';
import { useTheme } from '@/theme';
import { formatINR, parseAmountToPaise } from '@/utils/money';

export interface AmountInputProps extends Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'keyboardType'
> {
  /** Current value in integer paise, or null while the field is empty. */
  valuePaise: number | null;
  onChangePaise: (paise: number | null) => void;
  /** Show the parsed amount back to the user under the field. */
  showPreview?: boolean;
}

/**
 * A rupee field that never lets a float through: keystrokes are parsed straight
 * to integer paise, and anything unparseable surfaces as a validation error
 * rather than a silent NaN.
 */
export function AmountInput({
  valuePaise,
  onChangePaise,
  label,
  showPreview = true,
  error,
  hint,
  ...rest
}: AmountInputProps) {
  const theme = useTheme();
  // The raw string is local state so "12." and "0." stay typeable; paise are
  // the single source of truth for everyone upstream.
  const [text, setText] = useState(() =>
    valuePaise === null ? '' : formatINR(valuePaise, { withSymbol: false }),
  );
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback(
    (next: string) => {
      setText(next);
      setTouched(true);
      if (next.trim() === '') {
        onChangePaise(null);
        return;
      }
      const paise = parseAmountToPaise(next);
      onChangePaise(paise);
    },
    [onChangePaise],
  );

  const parseError = useMemo(() => {
    if (!touched || text.trim() === '') {
      return undefined;
    }
    return parseAmountToPaise(text) === null ? 'Enter a valid amount' : undefined;
  }, [text, touched]);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <TextInput
        label={label}
        keyboardType="decimal-pad"
        inputMode="decimal"
        value={text}
        onChangeText={handleChange}
        error={error ?? parseError}
        hint={hint}
        leading={
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[theme.typography.body, { color: theme.colors.textSecondary }]}
          >
            ₹
          </Text>
        }
        {...rest}
      />
      {showPreview && valuePaise !== null && (
        <Text
          accessibilityLabel={`Amount ${formatINR(valuePaise)}`}
          style={[styles.preview, theme.typography.caption, { color: theme.colors.textMuted }]}
        >
          {formatINR(valuePaise)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    textAlign: 'right',
  },
});
