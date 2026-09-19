/**
 * Supabase surfaces auth failures as codes and HTTP statuses. Screens should
 * never show those to a user, so every failure is mapped to one of these
 * cases with copy that says what happened and what to do next.
 */
export type AuthErrorKind =
  | 'invalid_otp'
  | 'expired_otp'
  | 'too_many_requests'
  | 'invalid_email'
  | 'network'
  | 'cancelled'
  | 'provider_unavailable'
  | 'unknown';

export interface FriendlyAuthError {
  kind: AuthErrorKind;
  /** One line, shown in the field error or a toast. */
  message: string;
  /** Whether retrying the same action could plausibly work. */
  retryable: boolean;
}

const MESSAGES: Record<AuthErrorKind, { message: string; retryable: boolean }> = {
  invalid_otp: {
    message: 'That code is not right. Check the digits and try again.',
    retryable: true,
  },
  expired_otp: {
    message: 'That code has expired. Tap resend to get a new one.',
    retryable: true,
  },
  too_many_requests: {
    message: 'Too many attempts. Wait a minute before trying again.',
    retryable: true,
  },
  invalid_email: {
    message: 'That email address does not look right.',
    retryable: true,
  },
  network: {
    message: 'Cannot reach FinPilot right now. Check your connection and try again.',
    retryable: true,
  },
  cancelled: {
    message: 'Sign-in was cancelled.',
    retryable: true,
  },
  provider_unavailable: {
    message: 'That sign-in method is not available on this device.',
    retryable: false,
  },
  unknown: {
    message: 'Something went wrong signing you in. Please try again.',
    retryable: true,
  },
};

/** The shape we care about from a supabase-js AuthError or a thrown Error. */
interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

function textOf(error: AuthErrorLike): string {
  return `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
}

export function classifyAuthError(error: unknown): AuthErrorKind {
  if (error === null || error === undefined) {
    return 'unknown';
  }

  const candidate = error as AuthErrorLike;
  const text = textOf(candidate);

  // The user backed out of the OAuth sheet; not an error worth alarming them.
  if (
    candidate.code === 'ERR_CANCELED' ||
    candidate.name === 'CancelledError' ||
    text.includes('cancel') ||
    text.includes('dismiss') ||
    text.includes('user_cancelled')
  ) {
    return 'cancelled';
  }

  if (text.includes('expired')) {
    return 'expired_otp';
  }

  if (
    candidate.code === 'otp_disabled' ||
    text.includes('invalid_credentials') ||
    text.includes('token has invalid') ||
    text.includes('invalid otp') ||
    text.includes('otp_invalid') ||
    (text.includes('invalid') && text.includes('token'))
  ) {
    return 'invalid_otp';
  }

  if (candidate.status === 429 || text.includes('rate limit') || text.includes('over_request')) {
    return 'too_many_requests';
  }

  if (text.includes('invalid email') || text.includes('validation_failed')) {
    return 'invalid_email';
  }

  if (
    candidate.name === 'AuthRetryableFetchError' ||
    candidate.name === 'TypeError' ||
    text.includes('network request failed') ||
    text.includes('fetch failed') ||
    text.includes('failed to fetch') ||
    text.includes('timeout')
  ) {
    return 'network';
  }

  if (
    text.includes('not available') ||
    text.includes('unsupported') ||
    text.includes('not supported')
  ) {
    return 'provider_unavailable';
  }

  return 'unknown';
}

export function toFriendlyAuthError(error: unknown): FriendlyAuthError {
  const kind = classifyAuthError(error);
  return { kind, ...MESSAGES[kind] };
}

/** A cancellation is a user choice, not a failure worth surfacing loudly. */
export function isSilentAuthError(error: unknown): boolean {
  return classifyAuthError(error) === 'cancelled';
}
