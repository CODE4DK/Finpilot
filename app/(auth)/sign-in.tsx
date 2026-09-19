import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Screen, TextInput } from '@/components';
import { useTheme } from '@/theme';

export default function SignInScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen accessibilityLabel="Sign in screen" scrollable>
      <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.lg }}>
        <Text style={[theme.typography.display, { color: theme.colors.text }]}>FinPilot</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Sign in to sync your accounts across devices.
        </Text>
      </View>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        autoComplete="current-password"
        secureTextEntry
        placeholder="••••••••"
      />

      <Button label="Sign in" fullWidth onPress={() => {}} />

      <Link href="/(auth)/forgot-password" accessibilityLabel="Forgot your password">
        <Text style={[theme.typography.label, { color: theme.colors.primary }]}>
          Forgot password?
        </Text>
      </Link>
      <Link href="/(auth)/sign-up" accessibilityLabel="Create an account">
        <Text style={[theme.typography.label, { color: theme.colors.primary }]}>
          New here? Create an account
        </Text>
      </Link>
    </Screen>
  );
}
