import { render as rntlRender, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/toast';
import { ThemeProvider, type ThemePreference } from '@/theme';

export interface RenderWithThemeOptions extends RenderOptions {
  /** Which scheme to render in. Defaults to light. */
  theme?: Exclude<ThemePreference, 'system'>;
  /** Wrap in a ToastProvider. Off unless the tree calls useToast. */
  withToast?: boolean;
}

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Renders a component inside the providers a real screen has: safe-area
 * metrics, the theme and (optionally) toasts. RNTL v14 render is async.
 */
export function renderWithTheme(ui: ReactElement, options: RenderWithThemeOptions = {}) {
  const { theme = 'light', withToast = false, ...rest } = options;

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <ThemeProvider preference={theme}>
        {withToast ? <ToastProvider>{children}</ToastProvider> : children}
      </ThemeProvider>
    </SafeAreaProvider>
  );

  return rntlRender(ui, { wrapper: Wrapper, ...rest });
}

export * from '@testing-library/react-native';
