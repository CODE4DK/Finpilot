import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Fraction of the screen height the sheet may occupy. */
  maxHeightRatio?: number;
  /** Tapping the dimmed backdrop closes the sheet. */
  dismissOnBackdropPress?: boolean;
  testID?: string;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeightRatio = 0.85,
  dismissOnBackdropPress = true,
  testID,
}: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Created once; see the note in skeleton.tsx on why this is state, not a ref.
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 160,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slide, visible]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [240, 0] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.root}>
        <Pressable
          // Decorative: anything outside `accessibilityViewIsModal` is hidden
          // from screen readers anyway, so the close affordance is the button
          // in the header, not this. It stays tappable for sighted users.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={dismissOnBackdropPress ? onClose : undefined}
          style={[styles.backdrop, { backgroundColor: theme.colors.backdrop }]}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              maxHeight: height * maxHeightRatio,
              paddingBottom: insets.bottom + theme.spacing.lg,
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.md,
              transform: [{ translateY }],
            },
            theme.elevation(3),
          ]}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.grabber,
              { backgroundColor: theme.colors.borderStrong, borderRadius: theme.radius.pill },
            ]}
          />
          <View style={[styles.header, { marginBottom: theme.spacing.md }]}>
            {title ? (
              <Text
                accessibilityRole="header"
                style={[styles.title, theme.typography.heading, { color: theme.colors.text }]}
              >
                {title}
              </Text>
            ) : (
              <View style={styles.title} />
            )}
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel="Close"
              accessibilityHint="Dismisses the sheet"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
              testID={testID ? `${testID}-close` : undefined}
            >
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  closeButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  grabber: {
    alignSelf: 'center',
    height: 4,
    marginBottom: 12,
    width: 40,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
  },
  title: {
    flex: 1,
  },
});
