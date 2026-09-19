import { Pressable, StyleSheet, Text, useColorScheme } from 'react-native';

import { AmountText } from '@/components/amount-text';
import { ScreenContainer } from '@/components/screen-container';
import { useSettingsStore } from '@/stores/settings-store';
import { darkColors, lightColors, radius, spacing, typography } from '@/theme';

/**
 * Phase 0 placeholder. Screens stay thin: no business logic here, only
 * composition of components and feature hooks.
 */
export default function HomeScreen() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const privacyMode = useSettingsStore((state) => state.privacyMode);
  const togglePrivacyMode = useSettingsStore((state) => state.togglePrivacyMode);

  return (
    <ScreenContainer accessibilityLabel="FinPilot home screen">
      <Text style={[typography.title, { color: colors.text }]}>FinPilot</Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>
        Offline-first personal finance. Phase 0 foundation is in place.
      </Text>

      <Text style={[typography.caption, { color: colors.textMuted }]}>Balance</Text>
      {privacyMode ? (
        <Text
          accessibilityLabel="Balance hidden by privacy mode"
          style={[typography.amount, { color: colors.text }]}
        >
          ••••••
        </Text>
      ) : (
        <AmountText amountPaise={0} />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={privacyMode ? 'Show amounts' : 'Hide amounts'}
        accessibilityState={{ selected: privacyMode }}
        onPress={togglePrivacyMode}
        style={[styles.button, { backgroundColor: colors.primary }]}
      >
        <Text style={[typography.body, styles.buttonLabel]}>
          {privacyMode ? 'Show amounts' : 'Hide amounts'}
        </Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
