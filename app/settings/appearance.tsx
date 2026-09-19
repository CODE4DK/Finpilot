import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Card, ListItem, Screen } from '@/components';
import { selectThemePreference, useSettingsStore } from '@/stores/settings-store';
import { useTheme, type ThemePreference } from '@/theme';

const OPTIONS: { value: ThemePreference; title: string; subtitle: string }[] = [
  { value: 'system', title: 'Follow system', subtitle: 'Matches your device setting' },
  { value: 'light', title: 'Light', subtitle: 'Always light' },
  { value: 'dark', title: 'Dark', subtitle: 'Always dark' },
];

export default function AppearanceScreen() {
  const theme = useTheme();
  const preference = useSettingsStore(selectThemePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);

  return (
    <Screen accessibilityLabel="Appearance settings screen" scrollable>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          {OPTIONS.map((option, index) => (
            <ListItem
              key={option.value}
              title={option.title}
              subtitle={option.subtitle}
              onPress={() => setThemePreference(option.value)}
              accessibilityLabel={`${option.title} theme`}
              accessibilityHint={
                preference === option.value ? 'Currently selected' : 'Switches the app theme'
              }
              trailing={
                preference === option.value ? (
                  <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                ) : null
              }
              showDivider={index < OPTIONS.length - 1}
              testID={`theme-option-${option.value}`}
            />
          ))}
        </View>
      </Card>
    </Screen>
  );
}
