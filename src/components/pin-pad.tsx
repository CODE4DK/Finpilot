import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PIN_LENGTH } from '@/features/app-lock/pin';
import { useTheme } from '@/theme';

export interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when the last digit lands. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  testID?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'] as const;

/**
 * An on-screen keypad rather than a TextInput: it keeps the PIN off the system
 * keyboard (and out of its dictionary and clipboard), and gives a target size
 * we control.
 */
export function PinPad({ value, onChange, onComplete, disabled, error, testID }: PinPadProps) {
  const theme = useTheme();

  const press = (key: string) => {
    if (disabled) {
      return;
    }
    if (key === 'delete') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= PIN_LENGTH) {
      return;
    }
    const next = value + key;
    onChange(next);
    if (next.length === PIN_LENGTH) {
      onComplete?.(next);
    }
  };

  return (
    <View style={{ gap: theme.spacing.xl }} testID={testID}>
      <View
        accessibilityLabel={`${value.length} of ${PIN_LENGTH} digits entered`}
        accessibilityLiveRegion="polite"
        style={[styles.dots, { gap: theme.spacing.md }]}
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index < value.length ? theme.colors.primary : 'transparent',
                borderColor: error ? theme.colors.expense : theme.colors.borderStrong,
              },
            ]}
          />
        ))}
      </View>

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[theme.typography.caption, styles.error, { color: theme.colors.expense }]}
        >
          {error}
        </Text>
      ) : null}

      <View style={styles.keypad}>
        {KEYS.map((key, index) => {
          if (key === '') {
            return <View key={`spacer-${index}`} style={styles.key} />;
          }
          const isDelete = key === 'delete';
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={isDelete ? 'Delete last digit' : key}
              accessibilityState={{ disabled: Boolean(disabled) }}
              disabled={disabled}
              onPress={() => press(key)}
              testID={`pin-key-${key}`}
              style={({ pressed }) => [
                styles.key,
                {
                  backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
                  borderRadius: theme.radius.pill,
                  opacity: disabled ? 0.4 : 1,
                },
              ]}
            >
              {isDelete ? (
                <Ionicons name="backspace-outline" size={24} color={theme.colors.text} />
              ) : (
                <Text style={[theme.typography.title, { color: theme.colors.text }]}>{key}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  error: {
    textAlign: 'center',
  },
  key: {
    alignItems: 'center',
    // Three columns; comfortably past the 44pt minimum.
    height: 64,
    justifyContent: 'center',
    width: '33.33%',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
