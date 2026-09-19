import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function SettingsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
      <Stack.Screen name="security" options={{ title: 'Security' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  );
}
