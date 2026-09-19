import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import type { ColorSchemeName } from './colors';
import { darkTheme, lightTheme, type Theme } from './theme';

export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Resolve the scheme actually used for rendering: the manual override when the
 * user picked one, otherwise whatever the OS reports (falling back to light
 * when the OS has no preference).
 */
export function resolveScheme(
  preference: ThemePreference,
  // RN reports 'unspecified' on platforms with no preference at all.
  systemScheme: ColorSchemeName | 'unspecified' | null | undefined,
): ColorSchemeName {
  if (preference === 'system') {
    return systemScheme === 'light' || systemScheme === 'dark' ? systemScheme : 'light';
  }
  return preference;
}

const ThemeContext = createContext<Theme>(lightTheme);

interface ThemeProviderProps {
  children: ReactNode;
  preference: ThemePreference;
  /** Injectable for tests; defaults to the OS setting. */
  systemScheme?: ColorSchemeName | 'unspecified' | null;
}

export function ThemeProvider({ children, preference, systemScheme }: ThemeProviderProps) {
  const osScheme = useColorScheme();
  const effective = systemScheme === undefined ? osScheme : systemScheme;
  const scheme = resolveScheme(preference, effective);
  const theme = useMemo(() => (scheme === 'dark' ? darkTheme : lightTheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Shorthand for the common case. */
export function useColors() {
  return useTheme().colors;
}
