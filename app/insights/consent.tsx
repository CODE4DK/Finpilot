import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, useToast } from '@/components';
import { useProfile, useProfilesRepository } from '@/db/hooks';
import { useTheme } from '@/theme';

/**
 * Consent, in the words of what actually happens.
 *
 * The list below is not a summary of a privacy policy - it is the literal
 * contents of the payload the Edge Function builds
 * (supabase/functions/generate-insights/payload.ts). If that file gains a
 * field, this screen is wrong, and the test that walks the payload against
 * its allow-list is what catches it.
 */

const SENT = [
  'The month you asked about, and the currency.',
  'Totals for the month: income, spending, and the number of transactions.',
  'Spending per category, with each category’s name - Food, Rent, Travel.',
  'Last month’s totals, so it can tell you what changed.',
  'Budget limits and how much of each you have used.',
  'Goal amounts and progress - as "goal_1", never the name you gave it.',
];

const NOT_SENT = [
  'Transaction notes. Ever.',
  'Account names, or anything about where you bank.',
  'Your name, email, or anything that identifies you.',
  'The names you gave your goals.',
  'Individual transactions - only the totals they add up to.',
];

export default function InsightsConsentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const profile = useProfile();
  const profiles = useProfilesRepository();
  const [saving, setSaving] = useState(false);

  const optedIn = profile?.ai_insights_opt_in === 1;

  const setOptIn = async (next: boolean) => {
    if (!profiles) {
      return;
    }
    setSaving(true);
    try {
      await profiles.setAiInsightsOptIn(next);
      toast.show(next ? 'AI insights are on' : 'AI insights are off', { tone: 'success' });
      if (next) {
        router.back();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen accessibilityLabel="AI insights consent screen" scrollable>
      <Card accessibilityLabel="What AI insights does">
        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
          A written read on your month
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
          ]}
        >
          FinPilot can send a summary of your month to Anthropic&rsquo;s Claude and get back a few
          sentences about what changed and what you might do. It only runs when you tap Generate -
          never on its own, never in the background.
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
          ]}
        >
          Without this, FinPilot still works out insights on your phone from the same numbers. Those
          never leave the device.
        </Text>
      </Card>

      <Section title="What is sent" icon="cloud-upload-outline" tone={theme.colors.info}>
        {SENT.map((line) => (
          <Bullet key={line} text={line} glyph="ellipse" color={theme.colors.textSecondary} />
        ))}
      </Section>

      <Section title="What is never sent" icon="lock-closed-outline" tone={theme.colors.income}>
        {NOT_SENT.map((line) => (
          <Bullet key={line} text={line} glyph="close" color={theme.colors.income} />
        ))}
      </Section>

      <Card accessibilityLabel="How long it is kept">
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
          Where it goes
        </Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: theme.spacing.xs },
          ]}
        >
          The request goes from your own Supabase project to the Claude API. The answer is stored in
          your account and synced to your devices like any other row. You can turn this off at any
          time, and delete the insights you have.
        </Text>
      </Card>

      {optedIn ? (
        <Button
          label="Turn off AI insights"
          variant="secondary"
          fullWidth
          loading={saving}
          onPress={() => void setOptIn(false)}
          accessibilityLabel="Turn off AI insights"
        />
      ) : (
        <Button
          label="Turn on AI insights"
          fullWidth
          size="lg"
          loading={saving}
          onPress={() => void setOptIn(true)}
          accessibilityLabel="Turn on AI insights"
        />
      )}
    </Screen>
  );
}

function Section({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card accessibilityLabel={title}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={tone} />
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>{title}</Text>
      </View>
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>{children}</View>
    </Card>
  );
}

function Bullet({
  text,
  glyph,
  color,
}: {
  text: string;
  glyph: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.bullet} accessible accessibilityLabel={text}>
      <Ionicons
        name={glyph}
        size={glyph === 'ellipse' ? 6 : 14}
        color={color}
        style={styles.glyph}
      />
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  glyph: { marginTop: 5 },
});
