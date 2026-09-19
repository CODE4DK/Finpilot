import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState, Screen, Skeleton, useToast } from '@/components';
import { useProfile } from '@/db/hooks';
import {
  SourceBadge,
  currentMonthKey,
  describeGenerateError,
  previousMonthKey,
  resolveInsight,
  severityTone,
  useGenerateInsight,
  useRuleBasedInsight,
  useStoredInsight,
} from '@/features/insights';
import { useTheme } from '@/theme';

export default function InsightsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();

  const months = useMemo(
    () => [
      { key: currentMonthKey(), label: 'This month' },
      { key: previousMonthKey(), label: 'Last month' },
    ],
    [],
  );
  const [month, setMonth] = useState(months[0]!.key);

  const profile = useProfile();
  const optedIn = profile?.ai_insights_opt_in === 1;

  const stored = useStoredInsight(month);
  const fallback = useRuleBasedInsight(month);
  const insight = resolveInsight(stored, fallback);

  const { generate, isGenerating, error, isOffline } = useGenerateInsight(month);

  const handleGenerate = async () => {
    const result = await generate();
    if (!result.ok && result.message) {
      toast.show(result.message, { tone: result.code === 'rate_limited' ? 'info' : 'warning' });
      return;
    }
    if (result.ok) {
      toast.show('Insight updated', { tone: 'success' });
    }
  };

  return (
    <Screen accessibilityLabel="Insights screen" scrollable>
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        {months.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            selected={month === option.key}
            onPress={() => setMonth(option.key)}
            accessibilityLabel={`Show ${option.label.toLowerCase()}`}
          />
        ))}
      </View>

      {isGenerating ? (
        <Card accessibilityLabel="Generating an insight">
          <Skeleton height={16} />
          <View style={{ height: theme.spacing.sm }} />
          <Skeleton height={16} width="80%" />
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, marginTop: theme.spacing.md },
            ]}
          >
            Reading your month&hellip;
          </Text>
        </Card>
      ) : (
        <Card accessibilityLabel={`Summary. ${insight.summary}`}>
          <View style={styles.header}>
            <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
            <Text style={[theme.typography.label, { color: theme.colors.primary }]}>Summary</Text>
            <SourceBadge source={insight.source} />
          </View>
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>
            {insight.summary}
          </Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, marginTop: theme.spacing.sm },
            ]}
          >
            {insight.source === 'ai'
              ? `Written by ${insight.model ?? 'Claude'} on ${formatWhen(insight.generated_at)}.`
              : 'Worked out on your phone from your own numbers.'}
          </Text>
        </Card>
      )}

      {error ? (
        <Card accessibilityLabel={describeGenerateError(error)}>
          <View style={styles.header}>
            <Ionicons
              name={error === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
              size={18}
              color={theme.colors.warning}
            />
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
              {error === 'offline' ? 'No connection' : 'Could not generate'}
            </Text>
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {describeGenerateError(error)}
          </Text>
        </Card>
      ) : null}

      <Section title="Worth knowing" items={insight.highlights.length}>
        {insight.highlights.map((highlight) => (
          <Row key={highlight.title} title={highlight.title} detail={highlight.detail} />
        ))}
      </Section>

      <Section title="Out of the ordinary" items={insight.unusual_spend.length}>
        {insight.unusual_spend.map((item) => (
          <Row
            key={item.category}
            title={item.category}
            detail={item.detail}
            // The severity is stated in the label as well as the colour: a
            // red dot on its own says nothing to a screen reader.
            accessibilityLabel={`${item.category}, ${item.severity} change. ${item.detail}`}
            leading={
              <View
                style={[styles.dot, { backgroundColor: severityTone(item.severity, theme.colors) }]}
              />
            }
          />
        ))}
      </Section>

      <Section title="What you could do" items={insight.suggestions.length}>
        {insight.suggestions.map((suggestion) => (
          <Row key={suggestion.title} title={suggestion.title} detail={suggestion.detail} />
        ))}
      </Section>

      {optedIn ? (
        <Button
          label="Generate for this month"
          fullWidth
          size="lg"
          loading={isGenerating}
          disabled={isOffline}
          onPress={() => void handleGenerate()}
          leading={<Ionicons name="sparkles" size={18} color={theme.colors.onPrimary} />}
          accessibilityLabel={
            isOffline
              ? 'Generate an insight. Unavailable while offline.'
              : 'Generate an AI insight for this month'
          }
        />
      ) : (
        <EmptyState
          icon="sparkles-outline"
          title="Want a written read too?"
          description="FinPilot can send a summary of your month - totals and category names, never your notes - and get a few sentences back."
          actionLabel="See what is sent"
          onAction={() => router.push('/insights/consent')}
        />
      )}

      {optedIn ? (
        <Button
          label="Manage AI insights"
          variant="tertiary"
          fullWidth
          onPress={() => router.push('/insights/consent')}
          accessibilityLabel="Manage AI insights and see what is sent"
        />
      ) : null}
    </Screen>
  );
}

function Section({
  title,
  items,
  children,
}: {
  title: string;
  items: number;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  if (items === 0) {
    return null;
  }
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text
        accessibilityRole="header"
        style={[theme.typography.heading, { color: theme.colors.text }]}
      >
        {title}
      </Text>
      <Card padded={false}>
        <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>{children}</View>
      </Card>
    </View>
  );
}

function Row({
  title,
  detail,
  leading,
  accessibilityLabel,
}: {
  title: string;
  detail: string;
  leading?: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? `${title}. ${detail}`}
      style={styles.row}
    >
      {leading ? (
        <View style={{ marginRight: theme.spacing.sm, marginTop: 6 }}>{leading}</View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{detail}</Text>
      </View>
    </View>
  );
}

function formatWhen(iso: string): string {
  const at = new Date(iso);
  return at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
