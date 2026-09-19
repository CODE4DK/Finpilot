import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, ProgressBar, Screen, TextInput } from '@/components';
import { canSubmitProfile, useOnboardingStore } from '@/features/onboarding/onboarding-store';
import { useTheme } from '@/theme';

/** INR is the default and the only currency Phase 3 supports end to end. */
const CURRENCIES = [{ code: 'INR', label: '₹ Indian Rupee' }] as const;

export default function OnboardingProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const fullName = useOnboardingStore((state) => state.fullName);
  const setFullName = useOnboardingStore((state) => state.setFullName);
  const currency = useOnboardingStore((state) => state.currency);
  const setCurrency = useOnboardingStore((state) => state.setCurrency);
  const [touched, setTouched] = useState(false);

  return (
    <Screen accessibilityLabel="Onboarding, your details" scrollable>
      <ProgressBar progress={1 / 3} accessibilityLabel="Step 1 of 3" />
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>
        Let&rsquo;s set you up
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        Just a couple of details — you can change all of this later in Settings.
      </Text>

      <TextInput
        label="Your name"
        value={fullName}
        onChangeText={setFullName}
        onBlur={() => setTouched(true)}
        error={touched && !canSubmitProfile(fullName) ? 'Please enter your name.' : undefined}
        autoCapitalize="words"
        autoComplete="name"
        autoFocus
        placeholder="Priya Sharma"
        returnKeyType="next"
      />

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>
          Currency
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {CURRENCIES.map((option) => (
            <Chip
              key={option.code}
              label={option.label}
              selected={currency === option.code}
              onPress={() => setCurrency(option.code)}
              accessibilityLabel={`Use ${option.label}`}
            />
          ))}
        </View>
      </View>

      <Button
        label="Continue"
        fullWidth
        disabled={!canSubmitProfile(fullName)}
        onPress={() => router.push('/(onboarding)/account')}
      />
    </Screen>
  );
}
