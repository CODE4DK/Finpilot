import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Switch, View } from 'react-native';

import { Card, ListItem, Screen } from '@/components';
import { selectPrivacyMode, useSettingsStore } from '@/stores/settings-store';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const privacyMode = useSettingsStore(selectPrivacyMode);
  const setPrivacyMode = useSettingsStore((state) => state.setPrivacyMode);

  const chevron = <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />;

  return (
    <Screen accessibilityLabel="Settings screen" scrollable>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <ListItem
            title="Appearance"
            subtitle="Theme and display"
            leading={
              <Ionicons name="color-palette-outline" size={22} color={theme.colors.primary} />
            }
            trailing={chevron}
            onPress={() => router.push('/settings/appearance')}
            showDivider
          />
          <ListItem
            title="Privacy mode"
            subtitle="Hide amounts on screen"
            leading={<Ionicons name="eye-off-outline" size={22} color={theme.colors.primary} />}
            trailing={
              <Switch
                accessibilityLabel="Toggle privacy mode"
                value={privacyMode}
                onValueChange={setPrivacyMode}
              />
            }
            showDivider
          />
          <ListItem
            title="About"
            subtitle="Version and licences"
            leading={
              <Ionicons name="information-circle-outline" size={22} color={theme.colors.primary} />
            }
            trailing={chevron}
            onPress={() => router.push('/settings/about')}
            showDivider={__DEV__}
          />
          {__DEV__ ? (
            <Link href="/dev/components" asChild>
              <ListItem
                title="Component gallery"
                subtitle="Development builds only"
                leading={
                  <Ionicons name="construct-outline" size={22} color={theme.colors.accent} />
                }
                trailing={chevron}
                onPress={() => router.push('/dev/components')}
              />
            </Link>
          ) : null}
        </View>
      </Card>
    </Screen>
  );
}
