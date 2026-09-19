import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function LockLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // There is no going around the lock screen.
        gestureEnabled: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="unlock" />
    </Stack>
  );
}
