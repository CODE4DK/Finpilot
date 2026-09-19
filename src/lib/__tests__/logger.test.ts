import { logWarn, redact } from '@/lib/logger';

describe('redact', () => {
  it('removes a JWT, which is the one true secret a client holds', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSJ9.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';

    expect(redact(`failed with ${token}`)).not.toContain('eyJhbGci');
    expect(redact(`failed with ${token}`)).toContain('[jwt]');
  });

  it('removes a labelled credential however it is written', () => {
    expect(redact('Authorization: Bearer abc123')).not.toContain('abc123');
    expect(redact('pin=4821')).not.toContain('4821');
    expect(redact({ apikey: 'sk-live-secret' })).not.toContain('sk-live-secret');
  });

  it('removes an email address', () => {
    expect(redact('could not load profile for alice@example.com')).toBe(
      'could not load profile for [email]',
    );
  });

  it('removes a mobile number, with or without the country code', () => {
    expect(redact('otp sent to +91 9876543210')).toContain('[phone]');
    expect(redact('otp sent to 9876543210')).toContain('[phone]');
  });

  it('removes an amount named as one', () => {
    // This is the shape a PostgREST error actually arrives in.
    const message =
      'duplicate key value violates unique constraint (amount_paise)=(500000) for transactions';

    const redacted = redact(message);

    expect(redacted).not.toContain('500000');
    expect(redacted).toContain('[amount]');
  });

  it('removes a rupee figure written for humans', () => {
    expect(redact('budget of ₹12,500 exceeded')).not.toContain('12,500');
    expect(redact('budget of Rs. 12500 exceeded')).not.toContain('12500');
  });

  it('removes a long run of digits, which is what paise look like', () => {
    expect(redact('row 184550000 rejected')).toContain('[digits]');
  });

  it('leaves a short, harmless number alone', () => {
    // Over-redacting makes logs useless; a status code is not a balance.
    expect(redact('request failed with 429')).toBe('request failed with 429');
  });

  it('reads an Error without dumping its stack', () => {
    const error = new Error('upload failed for alice@example.com');

    const redacted = redact(error);

    expect(redacted).toBe('Error: upload failed for [email]');
    expect(redacted).not.toContain('at ');
  });

  it('survives something that cannot be serialised', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(redact(circular)).toBe('[unserialisable]');
  });

  it('truncates a dumped object rather than writing a screenful', () => {
    const long = redact({ note: 'x'.repeat(2000) });

    expect(long.length).toBeLessThanOrEqual(515);
    expect(long.endsWith('[truncated]')).toBe(true);
  });
});

describe('log', () => {
  it('scopes the line and redacts both halves', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    logWarn('powersync', 'discarded PUT on transactions', 'amount_paise=500000');

    expect(warn).toHaveBeenCalledWith(
      '[powersync] discarded PUT on transactions - amount_paise=[amount]',
    );
    warn.mockRestore();
  });

  it('writes nothing extra when there is no detail', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    logWarn('auth', 'connect failed');

    expect(warn).toHaveBeenCalledWith('[auth] connect failed');
    warn.mockRestore();
  });
});
