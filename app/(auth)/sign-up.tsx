import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Screen, TextInput } from '@/components';
import { useTheme } from '@/theme';

export default function SignUpScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen accessibilityLabel="Create account screen" scrollable>
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>
        Create your account
      </Text>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        secureTextEntry
        hint="At least 8 characters."
      />
      <Button label="Create account" fullWidth onPress={() => {}} />
    </Screen>
  );
}
