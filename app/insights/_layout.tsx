import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function InsightsStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Insights' }} />
      <Stack.Screen name="consent" options={{ title: 'AI insights' }} />
    </Stack>
  );
}
