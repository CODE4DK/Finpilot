import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function TransactionsStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: 'Transaction' }} />
    </Stack>
  );
}
