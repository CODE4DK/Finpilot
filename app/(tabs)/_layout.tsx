import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';

import { TabBarAddButton } from '@/components';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: theme.typography.overline,
        // Tab labels live in a tight bar; cap the scale so they stay readable.
        tabBarAllowFontScaling: true,
        tabBarItemStyle: { minHeight: theme.minTouchTarget },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarAccessibilityLabel: 'Transactions tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: 'Add a transaction',
          tabBarButton: (props) => (
            <TabBarAddButton
              onPress={(event) => props.onPress?.(event)}
              accessibilityState={{ selected: props.accessibilityState?.selected }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Budgets',
          tabBarAccessibilityLabel: 'Budgets tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pie-chart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarAccessibilityLabel: 'Reports tab',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
