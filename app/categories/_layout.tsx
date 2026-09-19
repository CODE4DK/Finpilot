import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function CategoriesLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Categories' }} />
      <Stack.Screen name="new" options={{ title: 'New category', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Edit category', presentation: 'modal' }} />
    </Stack>
  );
}
