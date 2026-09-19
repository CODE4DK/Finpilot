import {
  ACCOUNT_TYPE_GLYPHS,
  ACCOUNT_TYPE_LABELS,
  canSaveAccount,
  createAccountDraft,
  describeAccountProblem,
  summariseNetWorth,
  toAccountValues,
  validateAccountDraft,
} from '@/features/accounts';
import { ACCOUNT_TYPES } from '@/db/enums';

describe('createAccountDraft', () => {
  it('defaults to a bank account with a zero opening balance', () => {
    expect(createAccountDraft()).toEqual({
      name: '',
      type: 'bank',
      openingBalancePaise: 0,
      color: null,
      icon: null,
    });
  });

  it('accepts overrides, for the edit screen', () => {
    expect(createAccountDraft({ name: 'HDFC', type: 'card' }).type).toBe('card');
  });
});

describe('validateAccountDraft', () => {
  it('accepts a named account', () => {
    expect(validateAccountDraft(createAccountDraft({ name: 'HDFC' }))).toEqual([]);
    expect(canSaveAccount(createAccountDraft({ name: 'HDFC' }))).toBe(true);
  });

  it('requires a name', () => {
    expect(validateAccountDraft(createAccountDraft())).toEqual(['name_missing']);
    expect(validateAccountDraft(createAccountDraft({ name: '   ' }))).toEqual(['name_missing']);
  });

  it('rejects a name the database would reject, before the database does', () => {
    expect(validateAccountDraft(createAccountDraft({ name: 'x'.repeat(81) }))).toEqual([
      'name_too_long',
    ]);
  });

  it('gives each problem a message', () => {
    expect(describeAccountProblem('name_missing')).toContain('name');
    expect(describeAccountProblem('name_too_long')).toContain('too long');
  });
});

describe('toAccountValues', () => {
  it('trims the name and keeps the balance in paise', () => {
    expect(
      toAccountValues(createAccountDraft({ name: '  HDFC  ', openingBalancePaise: 1050 })),
    ).toEqual({
      name: 'HDFC',
      type: 'bank',
      opening_balance_paise: 1050,
      color: null,
      icon: 'business-outline',
    });
  });

  it('allows a negative opening balance, as a credit card has', () => {
    expect(
      toAccountValues(
        createAccountDraft({ name: 'Amex', type: 'card', openingBalancePaise: -250000 }),
      ).opening_balance_paise,
    ).toBe(-250000);
  });

  it('falls back to the type glyph when no icon is chosen', () => {
    expect(toAccountValues(createAccountDraft({ name: 'Cash', type: 'cash' })).icon).toBe(
      'cash-outline',
    );
  });

  it('keeps an explicitly chosen icon', () => {
    expect(toAccountValues(createAccountDraft({ name: 'Cash', icon: 'star-outline' })).icon).toBe(
      'star-outline',
    );
  });

  it('refuses an invalid draft', () => {
    expect(() => toAccountValues(createAccountDraft())).toThrow(/not ready/);
  });
});

describe('type metadata', () => {
  it('labels and illustrates every account type the database allows', () => {
    for (const type of ACCOUNT_TYPES) {
      expect(ACCOUNT_TYPE_LABELS[type]).toBeTruthy();
      expect(ACCOUNT_TYPE_GLYPHS[type]).toBeTruthy();
    }
  });
});

describe('summariseNetWorth', () => {
  it('adds balances up', () => {
    expect(summariseNetWorth([{ balance_paise: 500000 }, { balance_paise: 10000000 }])).toEqual({
      totalPaise: 10500000,
      assetsPaise: 10500000,
      liabilitiesPaise: 0,
    });
  });

  it('separates what you owe, reported positively', () => {
    const summary = summariseNetWorth([{ balance_paise: 500000 }, { balance_paise: -250000 }]);

    expect(summary.totalPaise).toBe(250000);
    expect(summary.assetsPaise).toBe(500000);
    expect(summary.liabilitiesPaise).toBe(250000);
  });

  it('ignores a zero balance on both sides', () => {
    expect(summariseNetWorth([{ balance_paise: 0 }])).toEqual({
      totalPaise: 0,
      assetsPaise: 0,
      liabilitiesPaise: 0,
    });
  });

  it('is zero with no accounts', () => {
    expect(summariseNetWorth([])).toEqual({
      totalPaise: 0,
      assetsPaise: 0,
      liabilitiesPaise: 0,
    });
  });
});
