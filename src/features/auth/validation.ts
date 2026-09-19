/** Client-side checks that keep obviously bad input from costing a round trip. */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const OTP_LENGTH = 6;

export function isValidOtp(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code.trim());
}

/** Strips anything that is not a digit and caps the length - paste-friendly. */
export function sanitiseOtpInput(input: string): string {
  return input.replace(/\D/g, '').slice(0, OTP_LENGTH);
}
