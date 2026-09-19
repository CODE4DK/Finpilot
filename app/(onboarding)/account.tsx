import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AmountInput, Button, Chip, ProgressBar, Screen, TextInput } from '@/components';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_OPTIONS,
  canSubmitAccount,
  useOnboardingStore,
} from '@/features/onboarding/onboarding-store';
import { useTheme } from '@/theme';

export default function OnboardingAccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const accountName = useOnboardingStore((state) => state.accountName);
  const setAccountName = useOnboardingStore((state) => state.setAccountName);
  const accountType = useOnboardingStore((state) => state.accountType);
  const setAccountType = useOnboardingStore((state) => state.setAccountType);
  const openingBalancePaise = useOnboardingStore((state) => state.openingBalancePaise);
  const setOpeningBalancePaise = useOnboardingStore((state) => state.setOpeningBalancePaise);
  const [touched, setTouched] = useState(false);

  return (
    <Screen accessibilityLabel="Onboarding, your first account" scrollable>
      <ProgressBar progress={2 / 3} accessibilityLabel="Step 2 of 3" />
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>
        Add your first account
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        Where does most of your money sit today?
      </Text>

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>Type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {ACCOUNT_TYPE_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={ACCOUNT_TYPE_LABELS[option]}
              selected={accountType === option}
              onPress={() => setAccountType(option)}
              accessibilityLabel={ACCOUNT_TYPE_LABELS[option]}
            />
          ))}
        </View>
      </View>

      <TextInput
        label="Account name"
        value={accountName}
        onChangeText={setAccountName}
        onBlur={() => setTouched(true)}
        error={touched && !canSubmitAccount(accountName) ? 'Give the account a name.' : undefined}
        placeholder="HDFC Savings"
        autoCapitalize="words"
      />

      <AmountInput
        label="Opening balance"
        valuePaise={openingBalancePaise}
        onChangePaise={(paise) => setOpeningBalancePaise(paise ?? 0)}
        hint="What's in it right now. A credit card can be negative."
      />

      <Button
        label="Continue"
        fullWidth
        disabled={!canSubmitAccount(accountName)}
        onPress={() => router.push('/(onboarding)/app-lock')}
      />
    </Screen>
  );
}
