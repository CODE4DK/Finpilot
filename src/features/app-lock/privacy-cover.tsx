import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Drawn over the whole app while it is not active, so the app-switcher
 * snapshot shows this rather than someone's balances.
 */
export function PrivacyCover() {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="privacy-cover"
      style={[styles.cover, { backgroundColor: theme.colors.background, gap: theme.spacing.md }]}
    >
      <Ionicons name="lock-closed" size={40} color={theme.colors.primary} />
      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>FinPilot</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
});
