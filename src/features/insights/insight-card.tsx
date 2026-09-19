import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components';
import { useTheme } from '@/theme';

import type { Insight, Severity } from './types';

export interface InsightCardProps {
  insight: Insight;
  onPress?: () => void;
  testID?: string;
}

/**
 * The Home card: the summary line and the first thing worth knowing.
 *
 * Where the insight came from is always stated. A sentence written by a model
 * and a sentence computed from arithmetic deserve different amounts of trust,
 * and the user is the one who should be deciding that.
 */
export function InsightCard({ insight, onPress, testID }: InsightCardProps) {
  const theme = useTheme();
  const lead = insight.highlights[0] ?? insight.suggestions[0] ?? null;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Insights. ${insight.summary}${lead ? ` ${lead.title}. ${lead.detail}` : ''}`}
      testID={testID}
    >
      <View style={styles.header}>
        <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
        <Text style={[theme.typography.label, { color: theme.colors.primary }]}>Insights</Text>
        <SourceBadge source={insight.source} />
      </View>

      <Text style={[theme.typography.body, { color: theme.colors.text }]}>{insight.summary}</Text>

      {lead ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
            {lead.title}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {lead.detail}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/** "From your phone" / "Written by AI" - never left to the user to guess. */
export function SourceBadge({ source }: { source: Insight['source'] }) {
  const theme = useTheme();
  const isAi = source === 'ai';

  return (
    <View
      accessibilityLabel={isAi ? 'Written by AI' : 'Worked out on your phone'}
      style={[
        styles.badge,
        {
          backgroundColor: isAi ? theme.colors.infoSubtle : theme.colors.surfaceMuted,
          borderRadius: theme.radius.pill,
        },
      ]}
    >
      <Text
        style={[
          theme.typography.caption,
          { color: isAi ? theme.colors.info : theme.colors.textSecondary },
        ]}
        maxFontSizeMultiplier={theme.fontScaleCaps.control}
      >
        {isAi ? 'AI' : 'On device'}
      </Text>
    </View>
  );
}

export function severityTone(severity: Severity, colors: ReturnType<typeof useTheme>['colors']) {
  if (severity === 'high') {
    return colors.expense;
  }
  if (severity === 'medium') {
    return colors.warning;
  }
  return colors.textSecondary;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  badge: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2 },
});
