import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Switch, Text, View } from 'react-native';

import { Button, Card, ListItem, Screen, useToast } from '@/components';
import { getPermissionState, requestPermission, type PermissionState } from '@/features/budgets';
import { selectBudgetAlertsEnabled, useSettingsStore } from '@/stores/settings-store';
import { useTheme } from '@/theme';

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const toast = useToast();
  const budgetAlerts = useSettingsStore(selectBudgetAlertsEnabled);
  const setBudgetAlerts = useSettingsStore((state) => state.setBudgetAlertsEnabled);
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  useEffect(() => {
    void getPermissionState().then(setPermission);
  }, []);

  /**
   * The permission prompt belongs here, at the moment the user asks for
   * alerts - never at launch. iOS asks once, and a prompt with no context is
   * the one people deny for good.
   */
  const toggle = async (enabled: boolean) => {
    if (!enabled) {
      setBudgetAlerts(false);
      return;
    }

    const state = await requestPermission();
    setPermission(state);

    if (state === 'granted') {
      setBudgetAlerts(true);
      toast.show('Budget alerts are on', { tone: 'success' });
      return;
    }

    setBudgetAlerts(false);
    toast.show(
      state === 'denied'
        ? 'Notifications are turned off for FinPilot. Turn them on in your phone settings.'
        : 'Budget alerts need notification permission.',
      { tone: 'warning' },
    );
  };

  return (
    <Screen accessibilityLabel="Notification settings screen" scrollable>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <ListItem
            title="Budget alerts"
            subtitle="Tell me at 80% of a budget, and when it is used up"
            leading={
              <Ionicons name="notifications-outline" size={22} color={theme.colors.primary} />
            }
            trailing={
              <Switch
                accessibilityLabel="Toggle budget alerts"
                value={budgetAlerts}
                onValueChange={(next) => void toggle(next)}
              />
            }
          />
        </View>
      </Card>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        Each budget can alert you twice a month at most - once at 80% and once at 100%. The record
        of what has been sent syncs, so a second device stays quiet rather than repeating it.
      </Text>

      {permission === 'denied' ? (
        <Card accessibilityLabel="Notifications are blocked in your phone settings">
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
            Notifications are off for FinPilot
          </Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
            ]}
          >
            Your phone is blocking them, so the switch above cannot turn them on by itself.
          </Text>
          <View style={{ marginTop: theme.spacing.md }}>
            <Button
              label="Open phone settings"
              variant="secondary"
              onPress={() => void Linking.openSettings()}
              accessibilityLabel="Open FinPilot in your phone settings"
            />
          </View>
        </Card>
      ) : null}

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        FinPilot sends notifications from your device. Nothing about a budget or an amount leaves
        your phone to deliver one.
      </Text>
    </Screen>
  );
}
