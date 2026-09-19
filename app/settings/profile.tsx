import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, ListItem, Screen, TextInput, useToast } from '@/components';
import { useProfile, useProfilesRepository } from '@/db/hooks';
import { useAuthStore } from '@/features/auth';
import {
  MAX_NAME_LENGTH,
  describeProfileProblem,
  toProfileUpdate,
  validateProfileDraft,
} from '@/features/settings';
import { useTheme } from '@/theme';

export default function ProfileSettingsScreen() {
  const theme = useTheme();
  const toast = useToast();
  const profile = useProfile();
  const profiles = useProfilesRepository();
  const email = useAuthStore((state) => state.user?.email ?? null);

  const [saving, setSaving] = useState(false);

  // The profile arrives from a watched query, so it can land after the first
  // render. Seeding the field is done during render rather than in an effect:
  // an effect would paint an empty box first and fill it a frame later, and
  // an edit in flight must not be overwritten by a re-read of the same row.
  const storedName = profile?.full_name ?? '';
  const [edit, setEdit] = useState({ source: storedName, value: storedName });
  const fullName = edit.source === storedName ? edit.value : storedName;
  if (edit.source !== storedName) {
    setEdit({ source: storedName, value: storedName });
  }
  const setFullName = (value: string) => setEdit({ source: storedName, value });

  const draft = useMemo(
    () => ({ fullName, currency: profile?.currency ?? 'INR' }),
    [fullName, profile?.currency],
  );
  const problems = useMemo(() => validateProfileDraft(draft), [draft]);
  const dirty = storedName !== fullName.trim();

  const save = async () => {
    if (!profiles || problems.length > 0) {
      return;
    }
    setSaving(true);
    try {
      await profiles.update(profile!.id, toProfileUpdate(draft));
      toast.show('Profile saved', { tone: 'success' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen accessibilityLabel="Profile settings screen" scrollable>
      <Card>
        <TextInput
          label="Your name"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          autoComplete="name"
          maxLength={MAX_NAME_LENGTH}
          error={problems.length > 0 ? describeProfileProblem(problems[0]!) : undefined}
          hint="Shown on this device only. FinPilot never sends it anywhere else."
          accessibilityLabel="Your name"
        />
      </Card>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <ListItem
            title="Email"
            subtitle={email ?? 'Not signed in'}
            accessibilityLabel={`Signed in as ${email ?? 'nobody'}`}
            showDivider
          />
          <ListItem
            title="Currency"
            subtitle="Indian rupee (INR)"
            accessibilityLabel="Currency, Indian rupee"
            accessibilityHint="FinPilot is rupees only for now"
          />
        </View>
      </Card>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        Every amount in FinPilot is stored as whole paise in rupees. Supporting a second currency
        means converting your history, not changing a setting, so it is deliberately not one.
      </Text>

      <Button
        label="Save"
        fullWidth
        size="lg"
        loading={saving}
        disabled={!dirty || problems.length > 0}
        onPress={() => void save()}
        accessibilityLabel={dirty ? 'Save your profile' : 'Save your profile. Nothing has changed.'}
      />
    </Screen>
  );
}
