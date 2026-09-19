import { create } from 'zustand';

import { ACCOUNT_TYPES, type AccountType } from '@/db/enums';
import { createId } from '@/utils/id';

/**
 * Onboarding is a short wizard, so its answers live in one store until the
 * final step writes them. Nothing here touches the network.
 */
export interface OnboardingState {
  fullName: string;
  currency: string;
  accountName: string;
  accountType: AccountType;
  /** Integer paise; may be negative for a credit card. */
  openingBalancePaise: number;
  /** Generated up front so a retry does not create a duplicate account. */
  accountId: string;

  setFullName: (fullName: string) => void;
  setCurrency: (currency: string) => void;
  setAccountName: (name: string) => void;
  setAccountType: (type: AccountType) => void;
  setOpeningBalancePaise: (paise: number) => void;
  reset: () => void;
}

function initialState() {
  return {
    fullName: '',
    currency: 'INR',
    accountName: '',
    accountType: 'bank' as AccountType,
    openingBalancePaise: 0,
    accountId: createId(),
  };
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState(),

  setFullName: (fullName) => set({ fullName }),
  setCurrency: (currency) => set({ currency }),
  setAccountName: (accountName) => set({ accountName }),
  setAccountType: (accountType) => set({ accountType }),
  setOpeningBalancePaise: (openingBalancePaise) => set({ openingBalancePaise }),
  reset: () => set(initialState()),
}));

/** Labels for the account picker, in the order they are offered. */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank account',
  cash: 'Cash',
  card: 'Credit card',
  upi_wallet: 'UPI wallet',
};

export const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPES;

export function canSubmitProfile(fullName: string): boolean {
  return fullName.trim().length > 0;
}

export function canSubmitAccount(accountName: string): boolean {
  return accountName.trim().length > 0;
}
