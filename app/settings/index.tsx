import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { Button, Card, ListItem, Screen } from '@/components';
import { signOutEverywhere, useAuthStore } from '@/features/auth';
import { selectPrivacyMode, useSettingsStore } from '@/stores/settings-store';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const privacyMode = useSettingsStore(selectPrivacyMode);
  const setPrivacyMode = useSettingsStore((state) => state.setPrivacyMode);
  const profile = useAuthStore((state) => state.profile);
  const email = useAuthStore((state) => state.user?.email ?? null);
  const [signingOut, setSigningOut] = useState(false);

  const chevron = <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />;

  return (
    <Screen accessibilityLabel="Settings screen" scrollable>
      {profile || email ? (
        <Card accessibilityLabel="Signed in as">
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
            {profile?.full_name ?? 'Your account'}
          </Text>
          {email ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              {email}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <ListItem
            title="Security"
            subtitle="App lock, PIN and biometrics"
            leading={<Ionicons name="lock-closed-outline" size={22} color={theme.colors.primary} />}
            trailing={chevron}
            onPress={() => router.push('/settings/security')}
            showDivider
          />
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

      <Button
        label="Sign out"
        variant="secondary"
        fullWidth
        loading={signingOut}
        accessibilityLabel="Sign out of FinPilot"
        onPress={() => {
          setSigningOut(true);
          void signOutEverywhere().finally(() => setSigningOut(false));
        }}
      />
    </Screen>
  );
}
