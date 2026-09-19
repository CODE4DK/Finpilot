import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AmountText, Card, CategoryIcon, Chip, ListItem, ProgressBar, Screen } from '@/components';
import { useSyncSummary } from '@/db/hooks';
import { SyncIndicator, SyncStatusSheet } from '@/features/sync';
import { selectPrivacyMode, useSettingsStore } from '@/stores/settings-store';
import { useTheme } from '@/theme';

/** Placeholder rows; the reactive queries land with the screens in Phase 5. */
const SAMPLE_ROWS = [
  {
    id: '1',
    title: 'Big Bazaar',
    subtitle: 'Groceries · Today',
    paise: -184550,
    category: 'groceries',
  },
  { id: '2', title: 'Salary', subtitle: 'Income · 1 Sep', paise: 8500000, category: 'salary' },
  {
    id: '3',
    title: 'Uber',
    subtitle: 'Transport · Yesterday',
    paise: -24900,
    category: 'transport',
  },
] as const;

export default function HomeScreen() {
  const theme = useTheme();
  const privacyMode = useSettingsStore(selectPrivacyMode);
  const togglePrivacyMode = useSettingsStore((state) => state.togglePrivacyMode);
  const syncSummary = useSyncSummary();
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);

  return (
    <Screen accessibilityLabel="Home screen" scrollable>
      <View style={styles.headerRow}>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>Hello</Text>
        <View style={[styles.headerActions, { gap: theme.spacing.sm }]}>
          <SyncIndicator summary={syncSummary} onPress={() => setSyncSheetOpen(true)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={privacyMode ? 'Show amounts' : 'Hide amounts'}
            accessibilityState={{ selected: privacyMode }}
            hitSlop={12}
            onPress={togglePrivacyMode}
            style={styles.iconButton}
          >
            <Ionicons
              name={privacyMode ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={theme.colors.textSecondary}
            />
          </Pressable>
          <Link href="/settings" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              hitSlop={12}
              style={styles.iconButton}
            >
              <Ionicons name="settings-outline" size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </Link>
        </View>
      </View>

      <Card accessibilityLabel="Balance summary">
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          Total balance
        </Text>
        {privacyMode ? (
          <Text
            accessibilityLabel="Balance hidden by privacy mode"
            style={[theme.typography.amountLarge, { color: theme.colors.text }]}
          >
            ••••••
          </Text>
        ) : (
          <AmountText amountPaise={12456700} size="large" />
        )}
        <View style={[styles.summaryRow, { gap: theme.spacing.lg, marginTop: theme.spacing.md }]}>
          <View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              Income
            </Text>
            <AmountText amountPaise={8500000} size="small" colorBySign />
          </View>
          <View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Spent</Text>
            <AmountText amountPaise={-3245600} size="small" colorBySign />
          </View>
        </View>
      </Card>

      <View style={[styles.chipRow, { gap: theme.spacing.sm }]}>
        <Chip label="This month" selected onPress={() => {}} />
        <Chip label="Last month" onPress={() => {}} />
        <Chip label="Custom" onPress={() => {}} />
      </View>

      <Card accessibilityLabel="Monthly budget progress">
        <ProgressBar
          progress={0.62}
          label="Monthly budget"
          autoTone
          accessibilityLabel="Monthly budget used"
        />
      </Card>

      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Recent</Text>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          {SAMPLE_ROWS.map((row, index) => (
            <ListItem
              key={row.id}
              title={row.title}
              subtitle={row.subtitle}
              leading={<CategoryIcon category={row.category} />}
              trailing={<AmountText amountPaise={row.paise} size="small" colorBySign />}
              showDivider={index < SAMPLE_ROWS.length - 1}
              onPress={() => {}}
            />
          ))}
        </View>
      </Card>
      <SyncStatusSheet
        visible={syncSheetOpen}
        onClose={() => setSyncSheetOpen(false)}
        summary={syncSummary}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  summaryRow: {
    flexDirection: 'row',
  },
});
