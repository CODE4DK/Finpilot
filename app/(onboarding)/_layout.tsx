import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // No swipe-back: the wizard is linear and each step writes state.
        gestureEnabled: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="profile" />
      <Stack.Screen name="account" />
      <Stack.Screen name="app-lock" />
    </Stack>
  );
}
