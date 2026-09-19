import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Screen, TextInput } from '@/components';
import { useTheme } from '@/theme';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');

  return (
    <Screen accessibilityLabel="Reset password screen" scrollable>
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>Reset password</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        We’ll email you a link to set a new password.
      </Text>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Button label="Send reset link" fullWidth onPress={() => {}} />
    </Screen>
  );
}
