import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AmountInput, Button, Chip, Screen, TextInput, useToast } from '@/components';
import { useAccountsRepository } from '@/db/hooks';
import { useTheme } from '@/theme';

import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_OPTIONS,
  canSaveAccount,
  createAccountDraft,
  describeAccountProblem,
  toAccountValues,
  validateAccountDraft,
  type AccountDraft,
} from './account-form';

export interface AccountFormScreenProps {
  /** Present when editing; absent when creating. */
  accountId?: string;
  initial?: Partial<AccountDraft>;
  title: string;
  accessibilityLabel: string;
}

/**
 * Shared by the new-account and edit-account screens: the only difference is
 * whether it inserts or updates, and whether the opening balance can still be
 * changed.
 */
export function AccountFormScreen({
  accountId,
  initial,
  title,
  accessibilityLabel,
}: AccountFormScreenProps) {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const repository = useAccountsRepository();

  const [draft, setDraft] = useState<AccountDraft>(() => createAccountDraft(initial));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const problems = validateAccountDraft(draft);

  const save = async () => {
    if (!repository || !canSaveAccount(draft)) {
      setTouched(true);
      return;
    }

    setSaving(true);
    try {
      const values = toAccountValues(draft);
      if (accountId) {
        await repository.update(accountId, values);
      } else {
        await repository.insert(values);
      }
      toast.show(accountId ? 'Account updated' : 'Account added', { tone: 'success' });
      router.back();
    } catch {
      toast.show('Could not save the account', { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen accessibilityLabel={accessibilityLabel} scrollable>
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>{title}</Text>

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>Type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {ACCOUNT_TYPE_OPTIONS.map((type) => (
            <Chip
              key={type}
              label={ACCOUNT_TYPE_LABELS[type]}
              selected={draft.type === type}
              onPress={() => setDraft((current) => ({ ...current, type }))}
              accessibilityLabel={ACCOUNT_TYPE_LABELS[type]}
            />
          ))}
        </View>
      </View>

      <TextInput
        label="Name"
        value={draft.name}
        onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
        onBlur={() => setTouched(true)}
        error={touched && problems[0] ? describeAccountProblem(problems[0]) : undefined}
        placeholder="HDFC Savings"
        autoCapitalize="words"
        autoFocus={!accountId}
      />

      <AmountInput
        label="Opening balance"
        valuePaise={draft.openingBalancePaise}
        onChangePaise={(paise) =>
          setDraft((current) => ({ ...current, openingBalancePaise: paise ?? 0 }))
        }
        hint={
          accountId
            ? 'Changing this shifts every balance from the start.'
            : "What's in it right now. A credit card can be negative."
        }
      />

      <Button
        label={accountId ? 'Save changes' : 'Add account'}
        fullWidth
        loading={saving}
        disabled={!canSaveAccount(draft)}
        onPress={() => void save()}
      />
    </Screen>
  );
}
