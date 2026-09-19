import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Card, ListItem, Screen } from '@/components';
import { useTheme } from '@/theme';

export default function DevIndexScreen() {
  const theme = useTheme();
  const router = useRouter();
  const chevron = <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />;

  return (
    <Screen accessibilityLabel="Developer tools screen" scrollable>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <ListItem
            title="Component gallery"
            subtitle="Every component, in both themes"
            leading={<Ionicons name="color-filter-outline" size={22} color={theme.colors.accent} />}
            trailing={chevron}
            onPress={() => router.push('/dev/components')}
            showDivider
          />
          <ListItem
            title="Seed data"
            subtitle="10,000 transactions, for judging performance honestly"
            leading={<Ionicons name="flask-outline" size={22} color={theme.colors.accent} />}
            trailing={chevron}
            onPress={() => router.push('/dev/seed')}
          />
        </View>
      </Card>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        These screens exist only in development builds.
      </Text>
    </Screen>
  );
}
