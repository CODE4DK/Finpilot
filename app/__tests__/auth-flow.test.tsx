import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { useAppLockStore } from '@/features/app-lock/app-lock-store';
import { useAuthStore } from '@/features/auth/auth-store';
import { createFakeSupabase, type FakeSupabase } from '@/test-utils/supabase-mock';

// `mock`-prefixed so jest allows the factory below to close over it.
let mockSupabase: FakeSupabase;

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
  startSupabaseAutoRefresh: () => () => {},
}));

async function startAtEmailScreen() {
  await renderRouter('app', { initialUrl: '/(auth)/email' });
  await screen.findByLabelText('Email sign in screen');
}

describe('email OTP flow', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    useAppLockStore.getState().reset();
    mockSupabase = createFakeSupabase({ session: null, profile: null });
  });

  it('rejects a malformed email without calling Supabase', async () => {
    await startAtEmailScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));

    expect(screen.getByText('That email address does not look right.')).toBeOnTheScreen();
    expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends the code and moves to the verify screen', async () => {
    await startAtEmailScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'Alice@Example.com ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByLabelText('Verify code screen')).toBeOnTheScreen();
    // Normalised before it reaches the network.
    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' }),
    );
  });

  it('shows a friendly message when the network is down', async () => {
    mockSupabase.auth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: { name: 'AuthRetryableFetchError', message: 'Network request failed' },
    } as never);

    await startAtEmailScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'alice@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));

    expect(
      await screen.findByText(
        'Cannot reach FinPilot right now. Check your connection and try again.',
      ),
    ).toBeOnTheScreen();
  });

  it('shows the email on the verify screen and starts the resend timer', async () => {
    useAuthStore.getState().setPendingEmail('alice@example.com');

    await renderRouter('app', { initialUrl: '/(auth)/verify' });
    await screen.findByLabelText('Verify code screen');

    expect(screen.getByText(/alice@example\.com/)).toBeOnTheScreen();
    // The cooldown starts immediately, so resending is not offered yet.
    expect(screen.getByLabelText(/Resend in/)).toBeOnTheScreen();
  });

  it('reports a wrong code and clears the boxes', async () => {
    useAuthStore.getState().setPendingEmail('alice@example.com');
    mockSupabase.auth.verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Token has invalid claims', status: 401 },
    } as never);

    await renderRouter('app', { initialUrl: '/(auth)/verify' });
    await screen.findByLabelText('Verify code screen');

    await fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');

    expect(
      await screen.findByText('That code is not right. Check the digits and try again.'),
    ).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.getByLabelText('Verification code')).toHaveDisplayValue('');
    });
  });

  it('reports an expired code and points at resend', async () => {
    useAuthStore.getState().setPendingEmail('alice@example.com');
    mockSupabase.auth.verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Token has expired or is invalid', status: 401 },
    } as never);

    await renderRouter('app', { initialUrl: '/(auth)/verify' });
    await screen.findByLabelText('Verify code screen');

    await fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');

    expect(
      await screen.findByText('That code has expired. Tap resend to get a new one.'),
    ).toBeOnTheScreen();
  });

  it('only accepts digits, and caps the length', async () => {
    useAuthStore.getState().setPendingEmail('alice@example.com');

    await renderRouter('app', { initialUrl: '/(auth)/verify' });
    await screen.findByLabelText('Verify code screen');

    const input = screen.getByLabelText('Verification code');
    // Stops one digit short of complete, so this asserts sanitisation rather
    // than tripping the auto-submit.
    await fireEvent.changeText(input, '12ab34cd5');

    expect(input).toHaveDisplayValue('12345');
  });
});

describe('welcome screen', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    useAppLockStore.getState().reset();
    mockSupabase = createFakeSupabase({ session: null, profile: null });
  });

  it('offers email and Google, and hides Apple off iOS', async () => {
    await renderRouter('app', { initialUrl: '/(auth)/welcome' });
    await screen.findByLabelText('Welcome screen');

    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeOnTheScreen();
    // jest-expo runs the iOS platform by default but isAvailableAsync is mocked
    // to false, which is what a non-Apple device reports.
    expect(screen.queryByLabelText('Continue with Apple')).not.toBeOnTheScreen();
  });

  it('walks to the email screen', async () => {
    await renderRouter('app', { initialUrl: '/(auth)/welcome' });
    await screen.findByLabelText('Welcome screen');

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));

    expect(await screen.findByLabelText('Email sign in screen')).toBeOnTheScreen();
  });
});
