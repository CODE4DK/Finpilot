import { Link, Stack } from 'expo-router';
import { Text, useColorScheme } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { darkColors, lightColors, typography } from '@/theme';

export default function NotFoundScreen() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkColors : lightColors;

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <ScreenContainer accessibilityLabel="Route not found screen">
        <Text style={[typography.heading, { color: colors.text }]}>This screen doesn’t exist.</Text>
        <Link href="/" accessibilityLabel="Go back to the home screen">
          <Text style={[typography.body, { color: colors.primary }]}>Go to home</Text>
        </Link>
      </ScreenContainer>
    </>
  );
}
