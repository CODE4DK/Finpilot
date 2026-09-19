import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, PinPad, ProgressBar, Screen, useToast } from '@/components';
import {
  DEFAULT_APP_LOCK_SETTINGS,
  createPinRecord,
  getBiometricCapability,
  useAppLockStore,
  writeAppLockSettings,
  writePinRecord,
} from '@/features/app-lock';
import { completeOnboarding, createFirstAccount, useAuthStore } from '@/features/auth';
import { useOnboardingStore } from '@/features/onboarding/onboarding-store';
import { useTheme } from '@/theme';

type Stage = 'offer' | 'choose' | 'confirm';

export default function OnboardingAppLockScreen() {
  const theme = useTheme();
  const toast = useToast();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const setProfile = useAuthStore((state) => state.setProfile);
  const onboarding = useOnboardingStore();
  const setLockSettings = useAppLockStore((state) => state.setSettings);
  const setHasPin = useAppLockStore((state) => state.setHasPin);

  const [stage, setStage] = useState<Stage>('offer');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  /** Writes the profile and the first account, then lets the guard move on. */
  const finish = async (pinToStore?: string) => {
    if (!userId) {
      return;
    }
    setSaving(true);
    try {
      if (pinToStore) {
        const record = await createPinRecord(pinToStore);
        const capability = await getBiometricCapability();
        await writePinRecord(record);
        const settings = {
          ...DEFAULT_APP_LOCK_SETTINGS,
          enabled: true,
          biometricsEnabled: capability.available,
        };
        await writeAppLockSettings(settings);
        setLockSettings(settings);
        setHasPin(true);
      }

      await createFirstAccount(userId, {
        id: onboarding.accountId,
        name: onboarding.accountName,
        type: onboarding.accountType,
        openingBalancePaise: onboarding.openingBalancePaise,
      });

      const profile = await completeOnboarding(userId, {
        fullName: onboarding.fullName,
        currency: onboarding.currency,
      });

      setProfile(profile);
      onboarding.reset();
    } catch {
      toast.show('Could not finish setting up. Check your connection and try again.', {
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = (entered: string) => {
    if (stage === 'choose') {
      setFirstPin(entered);
      setPin('');
      setError(undefined);
      setStage('confirm');
      return;
    }

    if (entered !== firstPin) {
      setError('Those PINs did not match. Try again.');
      setPin('');
      setFirstPin('');
      setStage('choose');
      return;
    }

    void finish(entered);
  };

  return (
    <Screen accessibilityLabel="Onboarding, app lock" scrollable>
      <ProgressBar progress={1} accessibilityLabel="Step 3 of 3" />

      {stage === 'offer' ? (
        <>
          <View
            style={{
              alignItems: 'center',
              gap: theme.spacing.md,
              paddingVertical: theme.spacing.xl,
            }}
          >
            <Ionicons name="lock-closed-outline" size={40} color={theme.colors.primary} />
            <Text style={[theme.typography.title, { color: theme.colors.text }]}>
              Lock FinPilot?
            </Text>
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.textSecondary, textAlign: 'center' },
              ]}
            >
              Ask for your fingerprint, face or a 4-digit PIN when FinPilot opens. You can turn this
              on later in Settings.
            </Text>
          </View>

          <Button
            label="Set up app lock"
            fullWidth
            disabled={saving}
            onPress={() => setStage('choose')}
          />
          <Button
            label="Skip for now"
            variant="tertiary"
            fullWidth
            loading={saving}
            onPress={() => void finish()}
          />
        </>
      ) : (
        <>
          <Text style={[theme.typography.title, { color: theme.colors.text }]}>
            {stage === 'choose' ? 'Choose a PIN' : 'Confirm your PIN'}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            {stage === 'choose'
              ? 'Four digits. Avoid your birth year.'
              : 'Enter the same four digits again.'}
          </Text>

          <PinPad
            value={pin}
            onChange={setPin}
            onComplete={handleComplete}
            disabled={saving}
            error={error}
          />
        </>
      )}
    </Screen>
  );
}
