import type { AccountType } from '@/db/enums';
import { ACCOUNT_TYPES } from '@/db/enums';

/** The add/edit account form, as data. */
export interface AccountDraft {
  name: string;
  type: AccountType;
  openingBalancePaise: number;
  color: string | null;
  icon: string | null;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank account',
  cash: 'Cash',
  card: 'Credit card',
  upi_wallet: 'UPI wallet',
};

export const ACCOUNT_TYPE_GLYPHS: Record<AccountType, string> = {
  bank: 'business-outline',
  cash: 'cash-outline',
  card: 'card-outline',
  upi_wallet: 'phone-portrait-outline',
};

export const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPES;

export function createAccountDraft(overrides: Partial<AccountDraft> = {}): AccountDraft {
  return {
    name: '',
    type: 'bank',
    openingBalancePaise: 0,
    color: null,
    icon: null,
    ...overrides,
  };
}

export type AccountProblem = 'name_missing' | 'name_too_long';

export function validateAccountDraft(draft: AccountDraft): AccountProblem[] {
  const problems: AccountProblem[] = [];
  const name = draft.name.trim();

  if (name.length === 0) {
    problems.push('name_missing');
  } else if (name.length > 80) {
    // Matches the CHECK constraint, so the user hears about it before the
    // database does.
    problems.push('name_too_long');
  }

  return problems;
}

export function describeAccountProblem(problem: AccountProblem): string {
  return problem === 'name_missing' ? 'Give the account a name.' : 'That name is too long.';
}

export function canSaveAccount(draft: AccountDraft): boolean {
  return validateAccountDraft(draft).length === 0;
}

export interface AccountValues extends Record<string, unknown> {
  name: string;
  type: AccountType;
  opening_balance_paise: number;
  color: string | null;
  icon: string | null;
}

export function toAccountValues(draft: AccountDraft): AccountValues {
  if (!canSaveAccount(draft)) {
    throw new Error('Account draft is not ready to save.');
  }

  return {
    name: draft.name.trim(),
    type: draft.type,
    opening_balance_paise: draft.openingBalancePaise,
    color: draft.color,
    icon: draft.icon ?? ACCOUNT_TYPE_GLYPHS[draft.type],
  };
}
