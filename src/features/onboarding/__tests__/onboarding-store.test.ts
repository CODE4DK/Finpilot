import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_OPTIONS,
  canSubmitAccount,
  canSubmitProfile,
  useOnboardingStore,
} from '@/features/onboarding/onboarding-store';

describe('the onboarding store', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it('starts on the app defaults', () => {
    const state = useOnboardingStore.getState();

    expect(state.currency).toBe('INR');
    expect(state.accountType).toBe('bank');
    expect(state.openingBalancePaise).toBe(0);
    expect(state.fullName).toBe('');
  });

  it('generates the account id up front, so a retry cannot duplicate it', () => {
    const { accountId } = useOnboardingStore.getState();

    expect(accountId).toMatch(/^[0-9a-f-]{36}$/);

    useOnboardingStore.getState().setAccountName('HDFC');
    expect(useOnboardingStore.getState().accountId).toBe(accountId);
  });

  it('holds every answer the wizard collects', () => {
    const store = useOnboardingStore.getState();
    store.setFullName('Alice');
    store.setCurrency('INR');
    store.setAccountName('HDFC');
    store.setAccountType('card');
    store.setOpeningBalancePaise(-250000);

    expect(useOnboardingStore.getState()).toMatchObject({
      fullName: 'Alice',
      accountName: 'HDFC',
      accountType: 'card',
      // A credit card starts negative, which is why this is not unsigned.
      openingBalancePaise: -250000,
    });
  });

  it('resets to a fresh wizard, with a new account id', () => {
    const before = useOnboardingStore.getState().accountId;
    useOnboardingStore.getState().setFullName('Alice');

    useOnboardingStore.getState().reset();

    expect(useOnboardingStore.getState().fullName).toBe('');
    expect(useOnboardingStore.getState().accountId).not.toBe(before);
  });
});

describe('the step gates', () => {
  it('needs a name that is more than whitespace', () => {
    expect(canSubmitProfile('Alice')).toBe(true);
    expect(canSubmitProfile('   ')).toBe(false);
    expect(canSubmitProfile('')).toBe(false);
  });

  it('needs an account name too', () => {
    expect(canSubmitAccount('Cash')).toBe(true);
    expect(canSubmitAccount(' ')).toBe(false);
  });
});

describe('the account picker', () => {
  it('labels every type the database accepts', () => {
    for (const type of ACCOUNT_TYPE_OPTIONS) {
      expect(ACCOUNT_TYPE_LABELS[type]).toBeTruthy();
    }
  });
});
