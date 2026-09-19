/**
 * The profile form, as data.
 *
 * Validation mirrors the database CHECK constraints
 * (`supabase/migrations/20260919090000_initial_schema.sql`), so the user hears
 * about a problem from the form rather than from a failed sync they cannot
 * see. Every bound here has a constraint behind it.
 */

export interface ProfileDraft {
  fullName: string;
  currency: string;
}

/** `profiles_full_name_length`. */
export const MAX_NAME_LENGTH = 120;

/**
 * `profiles_currency_format` is `^[A-Z]{3}$`, but the app ships INR only:
 * every amount is integer paise and `formatINR` groups the Indian way. A
 * second currency is a data migration, not a dropdown.
 */
export const SUPPORTED_CURRENCIES = ['INR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type ProfileProblem = 'name_too_long' | 'name_invalid' | 'currency_unsupported';

/**
 * Control characters are the interesting case: a name is rendered straight
 * into accessibility labels and the CSV export, and a newline or a zero-width
 * character in it is at best confusing and at worst a way to spoof a row.
 */
const CONTROL_CHARACTERS = new RegExp(
  // Control characters, DEL, the zero-width and bidi range, and the line and
  // paragraph separators.
  '[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028\\u2029]',
);

export function validateProfileDraft(draft: ProfileDraft): ProfileProblem[] {
  const problems: ProfileProblem[] = [];
  const name = draft.fullName.trim();

  if (name.length > MAX_NAME_LENGTH) {
    problems.push('name_too_long');
  }
  if (CONTROL_CHARACTERS.test(draft.fullName)) {
    problems.push('name_invalid');
  }
  if (!SUPPORTED_CURRENCIES.includes(draft.currency as SupportedCurrency)) {
    problems.push('currency_unsupported');
  }

  return problems;
}

export function describeProfileProblem(problem: ProfileProblem): string {
  switch (problem) {
    case 'name_too_long':
      return `Keep the name under ${MAX_NAME_LENGTH} characters.`;
    case 'name_invalid':
      return 'That name has characters FinPilot cannot store.';
    case 'currency_unsupported':
      return 'FinPilot is rupees only for now.';
  }
}

/** What is actually written: trimmed, and an empty name stored as null. */
export function toProfileUpdate(draft: ProfileDraft): {
  full_name: string | null;
  currency: string;
} {
  const name = draft.fullName.trim();
  return { full_name: name.length === 0 ? null : name, currency: draft.currency };
}
