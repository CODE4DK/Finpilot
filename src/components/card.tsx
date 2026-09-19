import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { ElevationLevel } from '@/theme';

export interface CardProps {
  children: ReactNode;
  elevation?: ElevationLevel;
  padded?: boolean;
  onPress?: () => void;
  /** Required when the card is pressable. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({
  children,
  elevation = 1,
  padded = true,
  onPress,
  accessibilityLabel,
  style,
  testID,
}: CardProps) {
  const theme = useTheme();
  const surfaceStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: padded ? theme.spacing.lg : 0,
    },
    theme.elevation(elevation),
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [surfaceStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel} style={surfaceStyle} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
  },
});
