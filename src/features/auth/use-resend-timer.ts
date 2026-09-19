import { useCallback, useEffect, useState } from 'react';

/** Seconds a user must wait before another OTP can be requested. */
export const RESEND_COOLDOWN_SECONDS = 30;

export interface ResendTimer {
  secondsRemaining: number;
  canResend: boolean;
  /** Restart the cooldown - call right after a successful send. */
  start: () => void;
}

/**
 * Counts down the resend cooldown. Starts running immediately, because the
 * screen is only reached after a code has just been sent.
 */
export function useResendTimer(cooldownSeconds: number = RESEND_COOLDOWN_SECONDS): ResendTimer {
  const [secondsRemaining, setSecondsRemaining] = useState(cooldownSeconds);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      return;
    }
    const timeout = setTimeout(() => {
      setSecondsRemaining((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [secondsRemaining]);

  const start = useCallback(() => setSecondsRemaining(cooldownSeconds), [cooldownSeconds]);

  return { secondsRemaining, canResend: secondsRemaining <= 0, start };
}

/** "Resend in 0:24" / "Resend code" - kept pure so it can be unit tested. */
export function formatResendLabel(secondsRemaining: number): string {
  if (secondsRemaining <= 0) {
    return 'Resend code';
  }
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `Resend in ${minutes}:${String(seconds).padStart(2, '0')}`;
}
