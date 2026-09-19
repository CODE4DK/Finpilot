import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function AccountsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Accounts' }} />
      <Stack.Screen name="new" options={{ title: 'New account', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Account' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit account', presentation: 'modal' }} />
    </Stack>
  );
}
