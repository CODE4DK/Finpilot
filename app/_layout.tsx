import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components';
import { AuthGate } from '@/features/auth/auth-gate';
import { selectThemePreference, useSettingsStore } from '@/stores/settings-store';
import { initMonitoring } from '@/lib/monitoring';
import { ThemeProvider, useTheme } from '@/theme';

/**
 * Crash reporting starts before the first component renders, so a crash
 * during startup - the one a user cannot work around by trying again - is
 * still reported. It is a no-op in development and in any build without a
 * DSN; see src/lib/monitoring.ts.
 */
initMonitoring();

function RootStack() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { color: theme.colors.text },
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(lock)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="accounts" options={{ headerShown: false }} />
        <Stack.Screen name="transactions" options={{ headerShown: false }} />
        <Stack.Screen name="budgets" options={{ headerShown: false }} />
        <Stack.Screen name="goals" options={{ headerShown: false }} />
        <Stack.Screen name="categories" options={{ headerShown: false }} />
        <Stack.Screen name="recurring" options={{ headerShown: false }} />
        <Stack.Screen name="reports" options={{ headerShown: false }} />
        <Stack.Screen name="insights" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="dev" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

function RootLayout() {
  const themePreference = useSettingsStore(selectThemePreference);
  const hydratePreferences = useSettingsStore((state) => state.hydrate);

  // Preferences are read back once, at launch. Until they land the defaults
  // apply, which is why the theme flashes nothing worse than "system".
  useEffect(() => {
    void hydratePreferences();
  }, [hydratePreferences]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider preference={themePreference}>
          <ToastProvider>
            <AuthGate>
              <RootStack />
            </AuthGate>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * `Sentry.wrap` adds the error boundary and the navigation instrumentation.
 * It hands back the same component when reporting is off, so a development
 * build is unaffected.
 */
export default Sentry.wrap(RootLayout);
