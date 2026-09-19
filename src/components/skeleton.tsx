import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A shimmering placeholder. Hidden from screen readers - it says nothing. */
export function Skeleton({ width = '100%', height = 16, radius, style, testID }: SkeletonProps) {
  const theme = useTheme();
  // Lazy state, not a ref: the animated value must be created once, and
  // reading a ref during render is not allowed under the React Compiler rules.
  const [pulse] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: radius ?? theme.radius.sm,
          height,
          opacity: pulse,
          width,
        },
        style,
      ]}
    />
  );
}

/** Convenience: a few stacked lines, the shape of a loading list. */
export function SkeletonList({ rows = 3, testID }: { rows?: number; testID?: string }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel="Loading" testID={testID} style={{ gap: theme.spacing.md }}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={[styles.row, { gap: theme.spacing.md }]}>
          <Skeleton width={40} height={40} radius={theme.radius.md} />
          <View style={[styles.rowText, { gap: theme.spacing.xs }]}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  rowText: {
    flex: 1,
  },
});
