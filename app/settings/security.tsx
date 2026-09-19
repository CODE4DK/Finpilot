import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { BottomSheet, Button, Card, ListItem, PinPad, Screen, useToast } from '@/components';
import {
  clearPinRecord,
  createPinRecord,
  useAppLockStore,
  writeAppLockSettings,
  writePinRecord,
} from '@/features/app-lock';
import { useTheme } from '@/theme';

export default function SecuritySettingsScreen() {
  const theme = useTheme();
  const toast = useToast();
  const settings = useAppLockStore((state) => state.settings);
  const setSettings = useAppLockStore((state) => state.setSettings);
  const hasPin = useAppLockStore((state) => state.hasPin);
  const setHasPin = useAppLockStore((state) => state.setHasPin);
  const biometricsAvailable = useAppLockStore((state) => state.biometricsAvailable);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | undefined>();

  const persist = async (next: typeof settings) => {
    setSettings(next);
    await writeAppLockSettings(next);
  };

  const openPinSheet = () => {
    setPin('');
    setFirstPin('');
    setError(undefined);
    setSheetOpen(true);
  };

  const handlePinComplete = async (entered: string) => {
    if (!firstPin) {
      setFirstPin(entered);
      setPin('');
      return;
    }

    if (entered !== firstPin) {
      setError('Those PINs did not match.');
      setPin('');
      setFirstPin('');
      return;
    }

    await writePinRecord(await createPinRecord(entered));
    setHasPin(true);
    await persist({ ...settings, enabled: true });
    setSheetOpen(false);
    toast.show('App lock is on', { tone: 'success' });
  };

  const toggleLock = async (enabled: boolean) => {
    if (enabled && !hasPin) {
      openPinSheet();
      return;
    }

    await persist({ ...settings, enabled });

    if (!enabled) {
      // Turning the lock off removes the PIN too - leaving a stale hash on the
      // device serves no one.
      await clearPinRecord();
      setHasPin(false);
      toast.show('App lock is off');
    }
  };

  return (
    <Screen accessibilityLabel="Security settings screen" scrollable>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <ListItem
            title="App lock"
            subtitle="Ask for a PIN or biometrics when FinPilot opens"
            leading={<Ionicons name="lock-closed-outline" size={22} color={theme.colors.primary} />}
            trailing={
              <Switch
                accessibilityLabel="Toggle app lock"
                value={settings.enabled}
                onValueChange={(next) => void toggleLock(next)}
              />
            }
            showDivider
          />
          <ListItem
            title="Use biometrics"
            subtitle={
              biometricsAvailable
                ? 'Fingerprint or face, with your PIN as the fallback'
                : 'No biometrics enrolled on this device'
            }
            leading={
              <Ionicons name="finger-print-outline" size={22} color={theme.colors.primary} />
            }
            trailing={
              <Switch
                accessibilityLabel="Toggle biometric unlock"
                disabled={!settings.enabled || !biometricsAvailable}
                value={settings.biometricsEnabled && biometricsAvailable}
                onValueChange={(next) => void persist({ ...settings, biometricsEnabled: next })}
              />
            }
            showDivider
          />
          <ListItem
            title={hasPin ? 'Change PIN' : 'Set a PIN'}
            subtitle="Four digits, stored hashed in the device keychain"
            leading={<Ionicons name="keypad-outline" size={22} color={theme.colors.primary} />}
            trailing={<Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />}
            onPress={openPinSheet}
          />
        </View>
      </Card>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        The lock engages when FinPilot starts and after a minute in the background. Your PIN never
        leaves this device.
      </Text>

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={firstPin ? 'Confirm your PIN' : 'Choose a PIN'}
      >
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
          <PinPad
            value={pin}
            onChange={setPin}
            onComplete={(entered) => void handlePinComplete(entered)}
            error={error}
          />
          <Button label="Cancel" variant="tertiary" fullWidth onPress={() => setSheetOpen(false)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
