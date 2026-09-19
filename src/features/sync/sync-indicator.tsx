import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SyncState, SyncSummary } from '@/db/sync-status';
import { useTheme } from '@/theme';

export interface SyncIndicatorProps {
  summary: SyncSummary;
  onPress?: () => void;
  /** Show the state as words beside the dot. Off in tight headers. */
  showLabel?: boolean;
  testID?: string;
}

const ICONS: Record<SyncState, keyof typeof Ionicons.glyphMap> = {
  synced: 'cloud-done-outline',
  syncing: 'sync-outline',
  offline: 'cloud-offline-outline',
  error: 'alert-circle-outline',
};

const SHORT_LABELS: Record<SyncState, string> = {
  synced: 'Synced',
  syncing: 'Syncing',
  offline: 'Offline',
  error: 'Sync issue',
};

/**
 * The header's sync state. Colour alone never carries the meaning - there is
 * an icon and, optionally, a word - because colour-blind users and a glance in
 * sunlight both need more than a tinted dot.
 */
export function SyncIndicator({
  summary,
  onPress,
  showLabel = false,
  testID = 'sync-indicator',
}: SyncIndicatorProps) {
  const theme = useTheme();

  const tints: Record<SyncState, string> = {
    synced: theme.colors.income,
    syncing: theme.colors.info,
    offline: theme.colors.textMuted,
    error: theme.colors.expense,
  };

  const content = (
    <View style={[styles.row, { gap: theme.spacing.xs }]}>
      <Ionicons name={ICONS[summary.state]} size={16} color={tints[summary.state]} />
      {showLabel ? (
        <Text
          maxFontSizeMultiplier={theme.fontScaleCaps.compact}
          numberOfLines={1}
          style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
        >
          {SHORT_LABELS[summary.state]}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityRole="text" accessibilityLabel={summary.label} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={summary.label}
      accessibilityHint="Shows sync details"
      hitSlop={12}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
