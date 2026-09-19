import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function GoalsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Goals' }} />
      <Stack.Screen name="new" options={{ title: 'New goal', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Goal' }} />
    </Stack>
  );
}
