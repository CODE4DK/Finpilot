import { forwardRef, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';

import { useTheme } from '@/theme';
import { OTP_LENGTH, sanitiseOtpInput } from '@/features/auth/validation';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when the last digit lands, so the screen can submit automatically. */
  onComplete?: (value: string) => void;
  error?: string;
  editable?: boolean;
  autoFocus?: boolean;
  testID?: string;
}

/**
 * Six boxes backed by one hidden field: the OS gets a single input to autofill
 * the SMS/email code into, and screen readers get one labelled control rather
 * than six unlabelled ones.
 */
export const OtpInput = forwardRef<RNTextInput, OtpInputProps>(function OtpInput(
  { value, onChange, onComplete, error, editable = true, autoFocus = true, testID },
  ref,
) {
  const theme = useTheme();
  const internalRef = useRef<RNTextInput>(null);
  const inputRef = (ref as React.RefObject<RNTextInput>) ?? internalRef;

  const handleChange = (next: string) => {
    const sanitised = sanitiseOtpInput(next);
    onChange(sanitised);
    if (sanitised.length === OTP_LENGTH) {
      onComplete?.(sanitised);
    }
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Pressable
        accessibilityRole="none"
        onPress={() => inputRef.current?.focus()}
        style={[styles.boxes, { gap: theme.spacing.sm }]}
      >
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const digit = value[index] ?? '';
          const isCursor = index === value.length;
          return (
            <View
              key={index}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.box,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: error
                    ? theme.colors.expense
                    : isCursor
                      ? theme.colors.focus
                      : theme.colors.border,
                  borderRadius: theme.radius.md,
                  borderWidth: isCursor || error ? 2 : 1,
                },
              ]}
            >
              <Text style={[theme.typography.title, { color: theme.colors.text }]}>{digit}</Text>
            </View>
          );
        })}
      </Pressable>

      <RNTextInput
        ref={inputRef}
        accessibilityLabel="Verification code"
        accessibilityHint={error ?? `Enter the ${OTP_LENGTH}-digit code we emailed you`}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus={autoFocus}
        editable={editable}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        onChangeText={handleChange}
        style={styles.hidden}
        testID={testID ?? 'otp-input'}
        value={value}
      />

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[theme.typography.caption, { color: theme.colors.expense }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    flex: 1,
    height: 56,
    justifyContent: 'center',
  },
  boxes: {
    flexDirection: 'row',
  },
  hidden: {
    height: 1,
    opacity: 0,
    position: 'absolute',
    width: 1,
  },
});
