import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function BudgetsStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="new" options={{ title: 'Set a budget', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Budget', presentation: 'modal' }} />
    </Stack>
  );
}
