import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useTheme } from '@/theme';

export interface SwipeAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'primary' | 'expense';
  onPress: () => void;
}

export interface SwipeRowProps {
  children: ReactNode;
  /** Revealed by swiping left - destructive actions belong here. */
  rightActions?: SwipeAction[];
  /** Revealed by swiping right. */
  leftActions?: SwipeAction[];
  testID?: string;
}

/**
 * A row that reveals actions on swipe.
 *
 * Swiping is a shortcut, never the only way: every action here is also
 * reachable from the row's detail screen, because a gesture is invisible to a
 * screen reader and awkward one-handed.
 */
export function SwipeRow({ children, rightActions = [], leftActions = [], testID }: SwipeRowProps) {
  const theme = useTheme();

  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => {
    if (actions.length === 0) {
      return undefined;
    }

    function ActionPanel() {
      return (
        <View style={[styles.actions, side === 'left' && styles.actionsLeft]}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={action.onPress}
              testID={`${testID ?? 'row'}-action-${action.label.toLowerCase()}`}
              style={[
                styles.action,
                {
                  backgroundColor:
                    action.tone === 'expense' ? theme.colors.expense : theme.colors.primary,
                  gap: theme.spacing.xxs,
                },
              ]}
            >
              <Ionicons name={action.icon} size={20} color={theme.colors.onSemantic} />
              <Text
                maxFontSizeMultiplier={theme.fontScaleCaps.compact}
                style={[theme.typography.caption, { color: theme.colors.onSemantic }]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      );
    }

    return ActionPanel;
  };

  return (
    <ReanimatedSwipeable
      testID={testID}
      friction={2}
      rightThreshold={40}
      leftThreshold={40}
      renderRightActions={renderActions(rightActions, 'right')}
      renderLeftActions={renderActions(leftActions, 'left')}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  actions: {
    flexDirection: 'row',
  },
  actionsLeft: {
    flexDirection: 'row-reverse',
  },
});
