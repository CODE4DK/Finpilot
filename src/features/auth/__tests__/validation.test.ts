import {
  OTP_LENGTH,
  isValidEmail,
  isValidOtp,
  normaliseEmail,
  sanitiseOtpInput,
} from '@/features/auth/validation';

describe('isValidEmail', () => {
  it.each(['alice@example.com', 'a.b+tag@sub.domain.co.in', ' spaced@example.com '])(
    'accepts %p',
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  it.each(['', 'alice', 'alice@', '@example.com', 'alice@example', 'a b@example.com', 'a@b.c'])(
    'rejects %p',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );
});

describe('normaliseEmail', () => {
  it('trims and lowercases', () => {
    expect(normaliseEmail('  Alice@Example.COM ')).toBe('alice@example.com');
  });
});

describe('isValidOtp', () => {
  it('accepts exactly six digits', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp(' 123456 ')).toBe(true);
  });

  it.each(['', '12345', '1234567', '12345a'])('rejects %p', (code) => {
    expect(isValidOtp(code)).toBe(false);
  });

  it('is six digits long', () => {
    expect(OTP_LENGTH).toBe(6);
  });
});

describe('sanitiseOtpInput', () => {
  it('keeps only digits', () => {
    expect(sanitiseOtpInput('12ab34')).toBe('1234');
    expect(sanitiseOtpInput('1-2 3.4')).toBe('1234');
  });

  it('caps at the code length, so a pasted email body cannot overflow it', () => {
    expect(sanitiseOtpInput('Your code is 123456, expires in 10 minutes')).toBe('123456');
  });

  it('handles an empty string', () => {
    expect(sanitiseOtpInput('')).toBe('');
  });
});
