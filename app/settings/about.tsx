import Constants from 'expo-constants';
import { Text, View } from 'react-native';

import { Card, Screen } from '@/components';
import { useTheme } from '@/theme';

export default function AboutScreen() {
  const theme = useTheme();
  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <Screen accessibilityLabel="About screen" scrollable>
      <Card>
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={[theme.typography.heading, { color: theme.colors.text }]}>FinPilot</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Offline-first personal finance, built for Indian users.
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            Version {version}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}
