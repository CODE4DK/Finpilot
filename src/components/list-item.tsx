import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  /** Usually an amount or a chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Defaults to "title, subtitle" when pressable. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  showDivider?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  showDivider = false,
  style,
  testID,
}: ListItemProps) {
  const theme = useTheme();

  const body = (
    <View
      style={[
        styles.row,
        {
          gap: theme.spacing.md,
          minHeight: theme.minTouchTarget + theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        },
        showDivider && {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        style,
      ]}
    >
      {leading}
      <View style={styles.text}>
        <Text
          maxFontSizeMultiplier={theme.fontScaleCaps.control}
          numberOfLines={1}
          style={[theme.typography.bodyStrong, { color: theme.colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            maxFontSizeMultiplier={theme.fontScaleCaps.control}
            numberOfLines={1}
            style={[theme.typography.caption, { color: theme.colors.textMuted }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [pressed && { backgroundColor: theme.colors.surfaceMuted }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  text: {
    flex: 1,
  },
});
