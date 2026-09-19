import { Redirect, Stack } from 'expo-router';

import { useTheme } from '@/theme';

/**
 * Everything under /dev exists only in development builds. In a release build
 * `__DEV__` is false and the whole group redirects home, so the gallery can
 * never ship to users.
 */
export default function DevLayout() {
  const theme = useTheme();

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Developer' }} />
      <Stack.Screen name="components" options={{ title: 'Components' }} />
      <Stack.Screen name="seed" options={{ title: 'Seed data' }} />
    </Stack>
  );
}
