import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Biometrics are an accelerator, never the only way in: the PIN is always
 * available as a fallback, because hardware fails, fingers get wet, and a
 * device can have no enrolment at all.
 */

export interface BiometricCapability {
  available: boolean;
  /** 'Face ID', 'Touch ID', 'Fingerprint' … for use in button copy. */
  label: string;
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  return {
    available: hasHardware && isEnrolled,
    label: describeBiometrics(types),
  };
}

export function describeBiometrics(
  types: readonly LocalAuthentication.AuthenticationType[],
): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face unlock';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris';
  }
  return 'Biometrics';
}

export type BiometricOutcome = 'success' | 'cancelled' | 'unavailable' | 'failed';

export async function promptBiometrics(prompt = 'Unlock FinPilot'): Promise<BiometricOutcome> {
  const capability = await getBiometricCapability();
  if (!capability.available) {
    return 'unavailable';
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    // Keep the OS passcode sheet out of the way: our own PIN is the fallback.
    disableDeviceFallback: true,
    cancelLabel: 'Use PIN',
  });

  if (result.success) {
    return 'success';
  }
  if (
    result.error === 'user_cancel' ||
    result.error === 'system_cancel' ||
    result.error === 'app_cancel'
  ) {
    return 'cancelled';
  }
  return 'failed';
}
