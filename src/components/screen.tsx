import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Announced as the landmark for this screen. */
  accessibilityLabel: string;
  /** Wrap the content in a ScrollView. Off for screens with their own list. */
  scrollable?: boolean;
  /** Lift content above the keyboard. On by default - most screens have inputs. */
  keyboardAvoiding?: boolean;
  /** Which safe-area edges to inset. Screens inside the tab bar skip 'bottom'. */
  edges?: readonly Edge[];
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The outer shell every screen uses: safe-area insets, the themed background
 * and keyboard handling in one place, so screen files stay thin.
 */
export function Screen({
  children,
  accessibilityLabel,
  scrollable = false,
  keyboardAvoiding = true,
  edges = ['top', 'left', 'right'],
  padded = true,
  style,
  contentContainerStyle,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const padding = padded ? theme.spacing.lg : 0;

  const inner = scrollable ? (
    <ScrollView
      testID={testID ? `${testID}-scroll` : undefined}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        { gap: theme.spacing.md, padding, paddingBottom: theme.spacing.xxxl },
        contentContainerStyle,
      ]}
      style={styles.flex}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, { gap: theme.spacing.md, padding }, contentContainerStyle]}>
      {children}
    </View>
  );

  const body = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      {inner}
    </KeyboardAvoidingView>
  ) : (
    inner
  );

  return (
    <SafeAreaView
      accessibilityLabel={accessibilityLabel}
      edges={edges}
      testID={testID}
      style={[styles.flex, { backgroundColor: theme.colors.background }, style]}
    >
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
