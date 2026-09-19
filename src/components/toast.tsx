import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { createId } from '@/utils/id';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

export interface ShowToastOptions {
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. */
  duration?: number;
  /**
   * A single action, shown as a button in the toast. Used for Undo after a
   * delete - tapping it dismisses the toast as well as running the handler.
   */
  action?: ToastAction;
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
      const { tone = 'info', duration = DEFAULT_TOAST_DURATION, action } = options;
      const id = createId();
      setToasts((current) => [...current, { id, message, tone, action }]);
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
  const { toasts, dismiss } = useToast();

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
          {toast.action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toast.action.label}
              hitSlop={12}
              onPress={() => {
                toast.action?.onPress();
                dismiss(toast.id);
              }}
              testID={`toast-action-${toast.action.label.toLowerCase()}`}
              style={styles.action}
            >
              <Text
                style={[
                  theme.typography.label,
                  styles.actionLabel,
                  { color: theme.colors.onSemantic },
                ]}
              >
                {toast.action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 4,
  },
  actionLabel: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
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
