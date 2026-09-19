import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, OtpInput, Screen, useToast } from '@/components';
import {
  OTP_LENGTH,
  formatResendLabel,
  isValidOtp,
  sendEmailOtp,
  toFriendlyAuthError,
  useAuthStore,
  useResendTimer,
  verifyEmailOtp,
} from '@/features/auth';
import { useTheme } from '@/theme';

export default function VerifyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const email = useAuthStore((state) => state.pendingEmail);
  const busy = useAuthStore((state) => state.busy);
  const setBusy = useAuthStore((state) => state.setBusy);
  const resend = useResendTimer();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = async (candidate: string = code) => {
    if (!email) {
      router.replace('/(auth)/email');
      return;
    }
    if (!isValidOtp(candidate)) {
      setError(`Enter all ${OTP_LENGTH} digits.`);
      return;
    }

    setError(undefined);
    setBusy(true);
    try {
      await verifyEmailOtp(email, candidate);
      // The session listener in the root layout takes it from here.
    } catch (caught) {
      const friendly = toFriendlyAuthError(caught);
      setError(friendly.message);
      // A wrong code should not leave stale digits in the boxes.
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (!email || !resend.canResend) {
      return;
    }
    setBusy(true);
    try {
      await sendEmailOtp(email);
      resend.start();
      setCode('');
      setError(undefined);
      toast.show('New code sent', { tone: 'success' });
    } catch (caught) {
      toast.show(toFriendlyAuthError(caught).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen accessibilityLabel="Verify code screen" scrollable>
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>Enter your code</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        {email ? `We sent a ${OTP_LENGTH}-digit code to ${email}.` : 'We sent you a code.'}
      </Text>

      <OtpInput
        value={code}
        onChange={(next) => {
          setCode(next);
          if (error) {
            setError(undefined);
          }
        }}
        onComplete={(complete) => void submit(complete)}
        error={error}
        editable={!busy}
      />

      <Button
        label="Verify"
        fullWidth
        loading={busy}
        disabled={code.length < OTP_LENGTH}
        onPress={() => void submit()}
      />

      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={formatResendLabel(resend.secondsRemaining)}
          accessibilityState={{ disabled: !resend.canResend || busy }}
          disabled={!resend.canResend || busy}
          hitSlop={12}
          onPress={() => void resendCode()}
          style={{ minHeight: theme.minTouchTarget, justifyContent: 'center' }}
        >
          <Text
            style={[
              theme.typography.label,
              { color: resend.canResend ? theme.colors.primary : theme.colors.textMuted },
            ]}
          >
            {formatResendLabel(resend.secondsRemaining)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use a different email address"
          hitSlop={12}
          onPress={() => router.replace('/(auth)/email')}
          style={{ minHeight: theme.minTouchTarget, justifyContent: 'center' }}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            Use a different email
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
