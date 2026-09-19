import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, TextInput, useToast } from '@/components';
import { signOutEverywhere } from '@/features/auth';
import { CONFIRMATION_WORD, isConfirmed, requestAccountDeletion } from '@/features/settings';
import { useTheme } from '@/theme';

/**
 * Deleting an account, with the friction it deserves.
 *
 * The list below is what actually goes. It is not a summary of a policy: the
 * Edge Function deletes these tables, in this order, and then the auth user.
 */
const REMOVED = [
  'Every transaction, transfer and repeating rule.',
  'Your accounts, categories, budgets and goals.',
  'Any insights that were generated for you.',
  'Your profile, and your FinPilot sign-in itself.',
  'Everything held on this device.',
];

export default function DeleteAccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const confirmed = isConfirmed(confirmation);

  const handleDelete = async () => {
    if (!confirmed) {
      return;
    }
    setDeleting(true);
    try {
      const result = await requestAccountDeletion();

      if (!result.ok) {
        toast.show(result.message ?? 'Could not delete the account.', { tone: 'error' });
        return;
      }

      // The server has removed the account; now leave the device with nothing
      // on it. signOutEverywhere drops the local database, the session and the
      // app-lock PIN.
      await signOutEverywhere();
      toast.show('Your account has been deleted', { tone: 'info' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen accessibilityLabel="Delete account screen" scrollable>
      <Card accessibilityLabel="What deleting your account removes">
        <View style={styles.header}>
          <Ionicons name="warning-outline" size={20} color={theme.colors.expense} />
          <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
            This cannot be undone
          </Text>
        </View>

        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
          ]}
        >
          Deleting removes, permanently:
        </Text>

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          {REMOVED.map((line) => (
            <View key={line} style={styles.bullet} accessible accessibilityLabel={line}>
              <Ionicons
                name="close"
                size={14}
                color={theme.colors.expense}
                style={{ marginTop: 3 }}
              />
              <Text
                style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}
              >
                {line}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card accessibilityLabel="Export before deleting">
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
          Want a copy first?
        </Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
          ]}
        >
          Export your data before you delete. Afterwards there is nothing left to export.
        </Text>
        <View style={{ marginTop: theme.spacing.md }}>
          <Button
            label="Export my data"
            variant="secondary"
            onPress={() => router.push('/settings/data')}
            accessibilityLabel="Go back and export your data first"
          />
        </View>
      </Card>

      <Card>
        <TextInput
          label={`Type ${CONFIRMATION_WORD} to confirm`}
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel={`Type ${CONFIRMATION_WORD} to confirm deleting your account`}
          hint="Typing it out is the last check that this is deliberate."
        />
      </Card>

      <Button
        label="Delete my account"
        variant="destructive"
        fullWidth
        size="lg"
        loading={deleting}
        disabled={!confirmed}
        onPress={() => void handleDelete()}
        accessibilityLabel={
          confirmed
            ? 'Delete my account permanently'
            : `Delete my account. Type ${CONFIRMATION_WORD} above first.`
        }
      />

      <Button
        label="Keep my account"
        variant="tertiary"
        fullWidth
        onPress={() => router.back()}
        accessibilityLabel="Keep my account and go back"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
