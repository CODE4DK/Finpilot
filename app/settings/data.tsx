import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, ListItem, Screen, useToast } from '@/components';
import { getPowerSync } from '@/db/powersync';
import type { PowerSyncDatabaseLike } from '@/db/repositories/types';
import { useAuthStore } from '@/features/auth';
import { EXPORTED_TABLES, exportAllData } from '@/features/settings';
import { useTheme } from '@/theme';

export default function DataSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!userId) {
      return;
    }
    setExporting(true);
    try {
      const result = await exportAllData(
        getPowerSync() as unknown as PowerSyncDatabaseLike,
        userId,
        { appVersion: Constants.expoConfig?.version ?? '0.0.0' },
      );
      if (result.status === 'unavailable') {
        toast.show(`Saved ${result.rowCount} rows to this device`, { tone: 'info' });
      }
      // On success the share sheet is the confirmation; a toast behind it
      // would be talking over the thing the user asked for.
    } catch {
      toast.show('Could not export your data. Please try again.', { tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen accessibilityLabel="Data settings screen" scrollable>
      <Card accessibilityLabel="Export your data">
        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
          Export everything
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
          ]}
        >
          One JSON file with all {EXPORTED_TABLES.length} tables - accounts, categories,
          transactions, repeating rules, budgets, goals and insights - read from this device, so it
          works offline.
        </Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: theme.spacing.sm },
          ]}
        >
          Amounts are whole paise, the way FinPilot stores them. For a spreadsheet, use the CSV
          export on the Reports tab instead - it is per period and in rupees.
        </Text>

        <View style={{ marginTop: theme.spacing.lg }}>
          <Button
            label="Export my data"
            fullWidth
            loading={exporting}
            onPress={() => void handleExport()}
            leading={<Ionicons name="download-outline" size={18} color={theme.colors.onPrimary} />}
            accessibilityLabel="Export all of your FinPilot data as a file"
          />
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <ListItem
            title="Delete account"
            subtitle="Removes your account and everything in it, permanently"
            leading={<Ionicons name="trash-outline" size={22} color={theme.colors.expense} />}
            trailing={<Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />}
            onPress={() => router.push('/settings/delete-account')}
            accessibilityLabel="Delete your account"
            accessibilityHint="Opens a screen that explains what is removed"
          />
        </View>
      </Card>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        Export first if you want to keep a copy. Deleting is immediate and cannot be undone.
      </Text>
    </Screen>
  );
}
