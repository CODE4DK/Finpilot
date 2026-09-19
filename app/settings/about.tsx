import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Text, View } from 'react-native';

import { Card, ListItem, Screen } from '@/components';
import { LEGAL_LINKS, isSafeExternalUrl } from '@/features/settings';
import { useTheme } from '@/theme';

export default function AboutScreen() {
  const theme = useTheme();
  const version = Constants.expoConfig?.version ?? '0.0.0';
  // The build number moves with every store submission while the version does
  // not, and it is what a support conversation actually needs.
  const build = Application.nativeBuildVersion ?? 'dev';

  const open = (url: string) => {
    // Every URL here is a constant, but the guard is what stops that staying
    // true only by accident.
    if (isSafeExternalUrl(url)) {
      void WebBrowser.openBrowserAsync(url);
    }
  };

  return (
    <Screen accessibilityLabel="About screen" scrollable>
      <Card>
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={[theme.typography.heading, { color: theme.colors.text }]}>FinPilot</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Offline-first personal finance, built for Indian users.
          </Text>
          <Text
            accessibilityLabel={`Version ${version}, build ${build}`}
            style={[theme.typography.caption, { color: theme.colors.textMuted }]}
          >
            Version {version} ({build})
          </Text>
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          {LEGAL_LINKS.map((link, index) => (
            <ListItem
              key={link.url}
              title={link.title}
              subtitle={link.subtitle}
              leading={
                <Ionicons name="document-text-outline" size={22} color={theme.colors.primary} />
              }
              trailing={<Ionicons name="open-outline" size={18} color={theme.colors.textMuted} />}
              onPress={() => open(link.url)}
              accessibilityLabel={`${link.title}. Opens in your browser.`}
              showDivider={index < LEGAL_LINKS.length - 1}
            />
          ))}
        </View>
      </Card>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        FinPilot keeps your data on your device and in your own Supabase project. Nothing is sold,
        and nothing is shared with an advertiser.
      </Text>
    </Screen>
  );
}
