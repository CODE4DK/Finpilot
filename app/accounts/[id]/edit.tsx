import { useLocalSearchParams } from 'expo-router';

import { useAccountsWithBalances } from '@/features/accounts';
import { AccountFormScreen } from '@/features/accounts/account-form-screen';
import type { AccountType } from '@/db/enums';

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts } = useAccountsWithBalances();
  const account = accounts.find((candidate) => candidate.id === id);

  return (
    <AccountFormScreen
      accountId={id}
      title="Edit account"
      accessibilityLabel="Edit account screen"
      initial={
        account
          ? {
              name: account.name,
              type: account.type as AccountType,
              openingBalancePaise: account.opening_balance_paise,
              color: account.color,
              icon: account.icon,
            }
          : undefined
      }
    />
  );
}
