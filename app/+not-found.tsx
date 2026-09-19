import { Link, Stack } from 'expo-router';
import { Text } from 'react-native';

import { Screen } from '@/components';
import { useTheme } from '@/theme';

export default function NotFoundScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found', headerShown: true }} />
      <Screen accessibilityLabel="Route not found screen">
        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
          This screen doesn’t exist.
        </Text>
        <Link href="/" accessibilityLabel="Go back to the home screen">
          <Text style={[theme.typography.body, { color: theme.colors.primary }]}>Go to home</Text>
        </Link>
      </Screen>
    </>
  );
}
