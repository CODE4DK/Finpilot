import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Screen, TextInput } from '@/components';
import {
  isValidEmail,
  normaliseEmail,
  sendEmailOtp,
  toFriendlyAuthError,
  useAuthStore,
} from '@/features/auth';
import { useTheme } from '@/theme';

export default function EmailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setPendingEmail = useAuthStore((state) => state.setPendingEmail);
  const busy = useAuthStore((state) => state.busy);
  const setBusy = useAuthStore((state) => state.setBusy);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    if (!isValidEmail(email)) {
      setError('That email address does not look right.');
      return;
    }

    setError(undefined);
    setBusy(true);
    try {
      const normalised = normaliseEmail(email);
      await sendEmailOtp(normalised);
      setPendingEmail(normalised);
      router.push('/(auth)/verify');
    } catch (caught) {
      setError(toFriendlyAuthError(caught).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen accessibilityLabel="Email sign in screen" scrollable>
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>
        What&rsquo;s your email?
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        We&rsquo;ll send you a 6-digit code. No password to remember.
      </Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={(next) => {
          setEmail(next);
          if (error) {
            setError(undefined);
          }
        }}
        error={error}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        autoFocus
        inputMode="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        returnKeyType="send"
        onSubmitEditing={() => void submit()}
      />

      <Button
        label="Send code"
        fullWidth
        loading={busy}
        disabled={email.trim().length === 0}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
