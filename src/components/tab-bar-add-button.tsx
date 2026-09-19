import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { useTheme } from '@/theme';

export interface TabBarAddButtonProps {
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  testID?: string;
}

/**
 * The floating centre button of the tab bar. It is a tab like any other as far
 * as the navigator is concerned - it just draws itself as a raised circle.
 */
export function TabBarAddButton({
  onPress,
  accessibilityLabel = 'Add a transaction',
  accessibilityState,
  testID,
}: TabBarAddButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onPress={onPress}
      testID={testID ?? 'tab-add-button'}
      style={styles.pressable}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.circle,
            {
              backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
              borderColor: theme.colors.background,
            },
            theme.elevation(3),
          ]}
        >
          <Ionicons name="add" size={30} color={theme.colors.onPrimary} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 4,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    // Lift the button above the bar without stealing its layout slot.
    marginTop: -24,
    minHeight: 44,
    minWidth: 60,
  },
});
