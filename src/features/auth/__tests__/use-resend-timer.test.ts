import { act, renderHook } from '@testing-library/react-native';

import {
  RESEND_COOLDOWN_SECONDS,
  formatResendLabel,
  useResendTimer,
} from '@/features/auth/use-resend-timer';

describe('formatResendLabel', () => {
  it('counts down in minutes and seconds', () => {
    expect(formatResendLabel(30)).toBe('Resend in 0:30');
    expect(formatResendLabel(9)).toBe('Resend in 0:09');
    expect(formatResendLabel(65)).toBe('Resend in 1:05');
  });

  it('offers the resend once the cooldown is done', () => {
    expect(formatResendLabel(0)).toBe('Resend code');
    expect(formatResendLabel(-1)).toBe('Resend code');
  });
});

describe('useResendTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts on cooldown, because a code has just been sent', async () => {
    const { result } = await renderHook(() => useResendTimer(3));

    expect(result.current.secondsRemaining).toBe(3);
    expect(result.current.canResend).toBe(false);
  });

  // Each tick schedules the next one only after its re-render, so the timers
  // have to be advanced a second at a time rather than in one jump.
  async function tick(seconds: number) {
    for (let elapsed = 0; elapsed < seconds; elapsed += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
  }

  it('counts down to zero and then allows a resend', async () => {
    const { result } = await renderHook(() => useResendTimer(3));

    await tick(3);

    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.canResend).toBe(true);
  });

  it('restarts the cooldown when a new code is sent', async () => {
    const { result } = await renderHook(() => useResendTimer(2));

    await tick(2);
    expect(result.current.canResend).toBe(true);

    await act(async () => {
      result.current.start();
    });

    expect(result.current.secondsRemaining).toBe(2);
    expect(result.current.canResend).toBe(false);
  });

  it('defaults to a 30 second cooldown', () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(30);
  });
});
