import type { ReactNode } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { darkColors, lightColors, spacing } from '@/theme';

interface ScreenContainerProps {
  children: ReactNode;
  /** Announced by screen readers as the landmark for this screen. */
  accessibilityLabel: string;
}

export function ScreenContainer({ children, accessibilityLabel }: ScreenContainerProps) {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkColors : lightColors;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
