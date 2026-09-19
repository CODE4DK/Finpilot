import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, PinPad, Screen } from '@/components';
import {
  MAX_PIN_ATTEMPTS,
  getBiometricCapability,
  promptBiometrics,
  readPinRecord,
  useAppLockStore,
  verifyPin,
} from '@/features/app-lock';
import { signOutEverywhere } from '@/features/auth';
import { useTheme } from '@/theme';

export default function UnlockScreen() {
  const theme = useTheme();
  const unlock = useAppLockStore((state) => state.unlock);
  const registerFailedAttempt = useAppLockStore((state) => state.registerFailedAttempt);
  const failedAttempts = useAppLockStore((state) => state.failedAttempts);
  const biometricsEnabled = useAppLockStore((state) => state.settings.biometricsEnabled);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [checking, setChecking] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const promptedOnce = useRef(false);

  const lockedOut = failedAttempts >= MAX_PIN_ATTEMPTS;
  const remaining = Math.max(MAX_PIN_ATTEMPTS - failedAttempts, 0);

  const tryBiometrics = useCallback(async () => {
    const outcome = await promptBiometrics();
    if (outcome === 'success') {
      unlock();
    }
    // 'cancelled' and 'failed' both fall through to the PIN - no nagging.
  }, [unlock]);

  useEffect(() => {
    void getBiometricCapability().then((capability) => setBiometricLabel(capability.label));
  }, []);

  useEffect(() => {
    // Offer biometrics once on arrival; after that the user drives.
    if (promptedOnce.current || !biometricsEnabled || lockedOut) {
      return;
    }
    promptedOnce.current = true;
    void tryBiometrics();
  }, [biometricsEnabled, lockedOut, tryBiometrics]);

  const submit = async (candidate: string) => {
    setChecking(true);
    try {
      const record = await readPinRecord();
      if (!record) {
        // No PIN on file: the lock cannot be satisfied, so let them in rather
        // than trapping them out of their own data.
        unlock();
        return;
      }

      if (await verifyPin(candidate, record)) {
        setError(undefined);
        setPin('');
        unlock();
        return;
      }

      registerFailedAttempt();
      setPin('');
      setError(
        remaining <= 1
          ? 'Too many wrong attempts. Sign in again to continue.'
          : `Wrong PIN. ${remaining - 1} ${remaining - 1 === 1 ? 'try' : 'tries'} left.`,
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen accessibilityLabel="Unlock screen" keyboardAvoiding={false}>
      <View style={{ alignItems: 'center', gap: theme.spacing.sm, paddingTop: theme.spacing.xxl }}>
        <Ionicons name="lock-closed" size={36} color={theme.colors.primary} />
        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
          FinPilot is locked
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          {lockedOut ? 'Sign in again to continue.' : 'Enter your PIN to continue'}
        </Text>
      </View>

      {lockedOut ? (
        <Button
          label="Sign out"
          variant="secondary"
          fullWidth
          onPress={() => void signOutEverywhere()}
        />
      ) : (
        <>
          <PinPad
            value={pin}
            onChange={setPin}
            onComplete={(entered) => void submit(entered)}
            disabled={checking}
            error={error}
          />

          {biometricsEnabled ? (
            <Button
              label={`Use ${biometricLabel}`}
              variant="tertiary"
              fullWidth
              onPress={() => void tryBiometrics()}
              leading={
                <Ionicons name="finger-print-outline" size={20} color={theme.colors.primary} />
              }
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}
