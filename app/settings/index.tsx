import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { Button, Card, ListItem, Screen } from '@/components';
import { useProfile } from '@/db/hooks';
import { signOutEverywhere, useAuthStore } from '@/features/auth';
import { selectPrivacyMode, useSettingsStore } from '@/stores/settings-store';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const privacyMode = useSettingsStore(selectPrivacyMode);
  const setPrivacyMode = useSettingsStore((state) => state.setPrivacyMode);
  const profile = useProfile();
  const storedProfile = useAuthStore((state) => state.profile);
  const email = useAuthStore((state) => state.user?.email ?? null);
  const [signingOut, setSigningOut] = useState(false);

  const name = profile?.full_name ?? storedProfile?.full_name ?? null;
  const chevron = <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />;

  return (
    <Screen accessibilityLabel="Settings screen" scrollable>
      <Card
        accessibilityLabel={`Signed in as ${name ?? email ?? 'your account'}. Opens your profile.`}
        onPress={() => router.push('/settings/profile')}
      >
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
          {name ?? 'Your account'}
        </Text>
        {email ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{email}</Text>
        ) : null}
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.primary, marginTop: theme.spacing.xs },
          ]}
        >
          Edit profile
        </Text>
      </Card>

      <Group title="Your money">
        <ListItem
          title="Accounts"
          subtitle="Balances, archive and opening balances"
          leading={<Ionicons name="wallet-outline" size={22} color={theme.colors.primary} />}
          trailing={chevron}
          onPress={() => router.push('/accounts')}
          showDivider
        />
        <ListItem
          title="Categories"
          subtitle="Add, rename and archive"
          leading={<Ionicons name="pricetags-outline" size={22} color={theme.colors.primary} />}
          trailing={chevron}
          onPress={() => router.push('/categories')}
          showDivider
        />
        <ListItem
          title="Repeating"
          subtitle="Rent, subscriptions and salary"
          leading={<Ionicons name="repeat-outline" size={22} color={theme.colors.primary} />}
          trailing={chevron}
          onPress={() => router.push('/recurring')}
          showDivider
        />
        <ListItem
          title="Goals"
          subtitle="What you're saving for"
          leading={<Ionicons name="flag-outline" size={22} color={theme.colors.primary} />}
          trailing={chevron}
          onPress={() => router.push('/goals')}
        />
      </Group>

      <Group title="App">
        <ListItem
          title="Notifications"
          subtitle="Budget alerts at 80% and 100%"
          leading={<Ionicons name="notifications-outline" size={22} color={theme.colors.primary} />}
          trailing={chevron}
          onPress={() => router.push('/settings/notifications')}
          showDivider
        />
        <ListItem
          title="Security"
          subtitle="App lock, PIN, biometrics and timeout"
          leading={<Ionicons name="lock-closed-outline" size={22} color={theme.colors.primary} />}
          trailing={chevron}
          onPress={() => router.push('/settings/security')}
          showDivider
        />
        <ListItem
          title="Appearance"
          subtitle="Light, dark or follow your system"
          leading={<Ionicons name="color-palette-outline" size={22} color={theme.colors.primary} />}
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
        />
      </Group>

      <Group title="Your data">
        <ListItem
          title="AI insights"
          subtitle="A written read on your month, and exactly what it sends"
          leading={<Ionicons name="sparkles-outline" size={22} color={theme.colors.primary} />}
          trailing={chevron}
          onPress={() => router.push('/insights/consent')}
          showDivider
        />
        <ListItem
          title="Export and delete"
          subtitle="Take a copy, or remove your account for good"
          leading={<Ionicons name="archive-outline" size={22} color={theme.colors.primary} />}
          trailing={chevron}
          onPress={() => router.push('/settings/data')}
          showDivider
        />
        <ListItem
          title="About"
          subtitle="Version, privacy policy and terms"
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
              title="Developer tools"
              subtitle="Component gallery and seed data"
              leading={<Ionicons name="construct-outline" size={22} color={theme.colors.accent} />}
              trailing={chevron}
              onPress={() => router.push('/dev')}
            />
          </Link>
        ) : null}
      </Group>

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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text
        accessibilityRole="header"
        style={[theme.typography.label, { color: theme.colors.textMuted }]}
      >
        {title}
      </Text>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>{children}</View>
      </Card>
    </View>
  );
}
