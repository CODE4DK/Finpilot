import * as LocalAuthentication from 'expo-local-authentication';

import {
  describeBiometrics,
  getBiometricCapability,
  promptBiometrics,
} from '@/features/app-lock/biometrics';

const { FACIAL_RECOGNITION, FINGERPRINT, IRIS } = LocalAuthentication.AuthenticationType;

const mocked = {
  hasHardware: LocalAuthentication.hasHardwareAsync as jest.Mock,
  isEnrolled: LocalAuthentication.isEnrolledAsync as jest.Mock,
  types: LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock,
  authenticate: LocalAuthentication.authenticateAsync as jest.Mock,
};

beforeEach(() => {
  jest.clearAllMocks();
  mocked.hasHardware.mockResolvedValue(true);
  mocked.isEnrolled.mockResolvedValue(true);
  mocked.types.mockResolvedValue([FINGERPRINT]);
  mocked.authenticate.mockResolvedValue({ success: true });
});

describe('getBiometricCapability', () => {
  it('is available only with hardware *and* an enrolment', async () => {
    await expect(getBiometricCapability()).resolves.toMatchObject({ available: true });

    mocked.isEnrolled.mockResolvedValue(false);
    await expect(getBiometricCapability()).resolves.toMatchObject({ available: false });

    mocked.isEnrolled.mockResolvedValue(true);
    mocked.hasHardware.mockResolvedValue(false);
    await expect(getBiometricCapability()).resolves.toMatchObject({ available: false });
  });

  it('names the sensor, because the button copy says it out loud', async () => {
    mocked.types.mockResolvedValue([FACIAL_RECOGNITION]);

    await expect(getBiometricCapability()).resolves.toMatchObject({ label: 'Face unlock' });
  });
});

describe('describeBiometrics', () => {
  it('prefers face over fingerprint when a device has both', () => {
    expect(describeBiometrics([FINGERPRINT, FACIAL_RECOGNITION])).toBe('Face unlock');
  });

  it('names each sensor it knows', () => {
    expect(describeBiometrics([FINGERPRINT])).toBe('Fingerprint');
    expect(describeBiometrics([IRIS])).toBe('Iris');
  });

  it('falls back to a generic word rather than claiming a sensor', () => {
    expect(describeBiometrics([])).toBe('Biometrics');
  });
});

describe('promptBiometrics', () => {
  it('never reaches the sensor when there is nothing enrolled', async () => {
    mocked.isEnrolled.mockResolvedValue(false);

    await expect(promptBiometrics()).resolves.toBe('unavailable');
    expect(mocked.authenticate).not.toHaveBeenCalled();
  });

  it('keeps the OS passcode sheet out of the way - our PIN is the fallback', async () => {
    await promptBiometrics('Unlock FinPilot');

    expect(mocked.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ disableDeviceFallback: true, cancelLabel: 'Use PIN' }),
    );
  });

  it('reports a success', async () => {
    await expect(promptBiometrics()).resolves.toBe('success');
  });

  it.each(['user_cancel', 'system_cancel', 'app_cancel'])(
    'treats %s as cancelled, not as a failure',
    async (error) => {
      mocked.authenticate.mockResolvedValue({ success: false, error });

      await expect(promptBiometrics()).resolves.toBe('cancelled');
    },
  );

  it('treats a non-match as a failure, which the caller counts', async () => {
    mocked.authenticate.mockResolvedValue({ success: false, error: 'authentication_failed' });

    await expect(promptBiometrics()).resolves.toBe('failed');
  });
});
