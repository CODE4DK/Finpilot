import { classifyAuthError, isSilentAuthError, toFriendlyAuthError } from '@/features/auth/errors';

describe('classifyAuthError', () => {
  it('recognises a wrong code', () => {
    expect(classifyAuthError({ message: 'Token has invalid claims', status: 401 })).toBe(
      'invalid_otp',
    );
    expect(classifyAuthError({ message: 'invalid_credentials' })).toBe('invalid_otp');
  });

  it('recognises an expired code', () => {
    expect(classifyAuthError({ message: 'Token has expired or is invalid' })).toBe('expired_otp');
    expect(classifyAuthError({ message: 'OTP expired' })).toBe('expired_otp');
  });

  it('recognises rate limiting', () => {
    expect(classifyAuthError({ status: 429, message: 'Too many requests' })).toBe(
      'too_many_requests',
    );
    expect(classifyAuthError({ message: 'email rate limit exceeded' })).toBe('too_many_requests');
  });

  it('recognises a network failure', () => {
    expect(
      classifyAuthError({ name: 'AuthRetryableFetchError', message: 'Network request failed' }),
    ).toBe('network');
    expect(classifyAuthError(new TypeError('Failed to fetch'))).toBe('network');
  });

  it('recognises a cancelled OAuth sheet', () => {
    expect(classifyAuthError({ code: 'ERR_CANCELED' })).toBe('cancelled');
    expect(classifyAuthError({ name: 'CancelledError', message: 'Sign-in was cancelled.' })).toBe(
      'cancelled',
    );
    expect(classifyAuthError({ message: 'The user cancelled the request' })).toBe('cancelled');
  });

  it('recognises an unavailable provider', () => {
    expect(classifyAuthError({ message: 'Apple sign-in is not available on this device.' })).toBe(
      'provider_unavailable',
    );
  });

  it('recognises a bad email', () => {
    expect(classifyAuthError({ message: 'Unable to validate email address: invalid email' })).toBe(
      'invalid_email',
    );
  });

  it('falls back to unknown', () => {
    expect(classifyAuthError({ message: 'something strange happened' })).toBe('unknown');
    expect(classifyAuthError(null)).toBe('unknown');
    expect(classifyAuthError(undefined)).toBe('unknown');
    expect(classifyAuthError('a bare string')).toBe('unknown');
  });
});

describe('toFriendlyAuthError', () => {
  it('never leaks the raw message', () => {
    const friendly = toFriendlyAuthError({ message: 'AuthApiError: pq: duplicate key value' });
    expect(friendly.message).not.toContain('pq:');
    expect(friendly.message).toBe('Something went wrong signing you in. Please try again.');
  });

  it('marks an unavailable provider as not worth retrying', () => {
    expect(toFriendlyAuthError({ message: 'not available' }).retryable).toBe(false);
    expect(toFriendlyAuthError({ status: 429 }).retryable).toBe(true);
  });

  it('gives every kind a non-empty message', () => {
    for (const error of [
      { message: 'Token has expired' },
      { status: 429 },
      { code: 'ERR_CANCELED' },
      { name: 'AuthRetryableFetchError' },
      {},
    ]) {
      expect(toFriendlyAuthError(error).message.length).toBeGreaterThan(0);
    }
  });
});

describe('isSilentAuthError', () => {
  it('is true only for a cancellation', () => {
    expect(isSilentAuthError({ code: 'ERR_CANCELED' })).toBe(true);
    expect(isSilentAuthError({ status: 429 })).toBe(false);
  });
});
