import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Screen, useToast } from '@/components';
import {
  isAppleSignInAvailable,
  isSilentAuthError,
  signInWithApple,
  signInWithGoogle,
  toFriendlyAuthError,
  useAuthStore,
} from '@/features/auth';
import { useTheme } from '@/theme';

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const busy = useAuthStore((state) => state.busy);
  const setBusy = useAuthStore((state) => state.setBusy);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const runProvider = async (provider: 'google' | 'apple') => {
    setBusy(true);
    try {
      await (provider === 'google' ? signInWithGoogle() : signInWithApple());
      // The auth listener in the root layout picks up the session and the
      // route guard moves us on; nothing to navigate here.
    } catch (error) {
      if (!isSilentAuthError(error)) {
        toast.show(toFriendlyAuthError(error).message, { tone: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen accessibilityLabel="Welcome screen" scrollable>
      <View style={[styles.hero, { gap: theme.spacing.sm, paddingVertical: theme.spacing.xxxl }]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.mark,
            { backgroundColor: theme.colors.primarySubtle, borderRadius: theme.radius.xl },
          ]}
        >
          <Ionicons name="wallet" size={36} color={theme.colors.primary} />
        </View>
        <Text style={[theme.typography.display, { color: theme.colors.text }]}>FinPilot</Text>
        <Text
          style={[theme.typography.body, styles.centered, { color: theme.colors.textSecondary }]}
        >
          Track spending, budgets and goals — in rupees, and offline.
        </Text>
      </View>

      <Button
        label="Continue with email"
        fullWidth
        size="lg"
        disabled={busy}
        onPress={() => router.push('/(auth)/email')}
        leading={<Ionicons name="mail-outline" size={20} color={theme.colors.onPrimary} />}
      />

      <Button
        label="Continue with Google"
        variant="secondary"
        fullWidth
        size="lg"
        disabled={busy}
        onPress={() => void runProvider('google')}
        leading={<Ionicons name="logo-google" size={20} color={theme.colors.text} />}
      />

      {appleAvailable && Platform.OS === 'ios' ? (
        <AppleAuthentication.AppleAuthenticationButton
          accessibilityLabel="Continue with Apple"
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            theme.scheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={theme.radius.md}
          style={styles.appleButton}
          onPress={() => void runProvider('apple')}
        />
      ) : null}

      <Text style={[theme.typography.caption, styles.centered, { color: theme.colors.textMuted }]}>
        By continuing you agree to keep your money data on your device and in your own Supabase
        project.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  appleButton: {
    height: 56,
    width: '100%',
  },
  centered: {
    textAlign: 'center',
  },
  hero: {
    alignItems: 'center',
  },
  mark: {
    alignItems: 'center',
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
});
