import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { useTheme } from '@/theme';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Ionicons glyph name. */
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export function EmptyState({
  title,
  description,
  icon = 'file-tray-outline',
  actionLabel,
  onAction,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={description ? `${title}. ${description}` : title}
      testID={testID}
      style={[styles.container, { gap: theme.spacing.md, padding: theme.spacing.xl }]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.iconCircle,
          { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.pill },
        ]}
      >
        <Ionicons name={icon} size={28} color={theme.colors.textMuted} />
      </View>
      <Text style={[theme.typography.heading, styles.centered, { color: theme.colors.text }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[theme.typography.body, styles.centered, { color: theme.colors.textSecondary }]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="primary" size="sm" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
});
