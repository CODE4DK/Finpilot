import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { createId } from '@/utils/id';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface ShowToastOptions {
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. */
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  show: (message: string, options?: ShowToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const DEFAULT_TOAST_DURATION = 3200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, options: ShowToastOptions = {}) => {
      const { tone = 'info', duration = DEFAULT_TOAST_DURATION } = options;
      const id = createId();
      setToasts((current) => [...current, { id, message, tone }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }
  return context;
}

const TONE_ICONS: Record<ToastTone, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
};

/** Renders the stack of live toasts above everything else. */
export function ToastViewport() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { toasts } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  const fills: Record<ToastTone, string> = {
    success: theme.colors.income,
    error: theme.colors.expense,
    warning: theme.colors.warning,
    info: theme.colors.info,
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.viewport, { bottom: insets.bottom + theme.spacing.xl, gap: theme.spacing.sm }]}
    >
      {toasts.map((toast) => (
        <View
          key={toast.id}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          accessibilityLabel={toast.message}
          testID={`toast-${toast.tone}`}
          style={[
            styles.toast,
            {
              backgroundColor: fills[toast.tone],
              borderRadius: theme.radius.md,
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
            },
            theme.elevation(2),
          ]}
        >
          <Ionicons name={TONE_ICONS[toast.tone]} size={18} color={theme.colors.onSemantic} />
          <Text
            style={[theme.typography.label, styles.message, { color: theme.colors.onSemantic }]}
          >
            {toast.message}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    flex: 1,
  },
  toast: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  viewport: {
    left: 16,
    position: 'absolute',
    right: 16,
  },
});
