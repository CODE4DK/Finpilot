import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AmountText,
  Button,
  Card,
  CategoryIcon,
  Chip,
  EmptyState,
  Screen,
  useToast,
} from '@/components';
import {
  PRESET_LABELS,
  REPORT_PRESETS,
  SpendDonut,
  TrendBars,
  describeCategoryChange,
  describeCategoryChart,
  describeTrendChart,
  useCsvExport,
  useReportData,
  useReportPeriod,
  type CategoryChange,
  type CategorySlice,
} from '@/features/reports';
import { useTheme } from '@/theme';
import { formatINR } from '@/utils/money';

export default function ReportsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();

  const { preset, setPreset, period, selectCustom } = useReportPeriod();
  const report = useReportData(period);
  const { isExporting, exportCsv } = useCsvExport(period);

  const [picking, setPicking] = useState<'start' | 'end' | null>(null);
  const [customStart, setCustomStart] = useState<Date | null>(null);

  const hasSpend = report.slices.length > 0;
  const hasAnything = hasSpend || report.incomePaise > 0;

  /**
   * The custom range is two taps on one picker: pick a start, the picker comes
   * straight back for the end. Cancelling either one leaves the current period
   * alone rather than half-applying a range.
   */
  const handleDate = (which: 'start' | 'end', date?: Date) => {
    setPicking(Platform.OS === 'ios' && date ? picking : null);
    if (!date) {
      setPicking(null);
      setCustomStart(null);
      return;
    }
    if (which === 'start') {
      setCustomStart(date);
      setPicking('end');
      return;
    }
    setPicking(null);
    selectCustom({ start: customStart ?? date, end: date });
    setCustomStart(null);
  };

  const handleExport = async () => {
    try {
      const result = await exportCsv();
      if (result.status === 'empty') {
        toast.show('Nothing to export for this period', { tone: 'info' });
      } else if (result.status === 'unavailable') {
        toast.show(`Saved ${result.rowCount} transactions to this device`, { tone: 'info' });
      }
      // On success the share sheet is the confirmation - a toast behind it
      // would be talking over the thing the user asked for.
    } catch {
      toast.show('Could not export. Please try again.', { tone: 'error' });
    }
  };

  return (
    <Screen accessibilityLabel="Reports screen" scrollable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.lg }}
      >
        {REPORT_PRESETS.map((option) => (
          <Chip
            key={option}
            label={PRESET_LABELS[option]}
            selected={preset === option}
            onPress={() => (option === 'custom' ? setPicking('start') : setPreset(option))}
            accessibilityLabel={
              option === 'custom' ? 'Pick a custom date range' : `Show ${PRESET_LABELS[option]}`
            }
          />
        ))}
      </ScrollView>

      <Card accessibilityLabel={`Summary for ${period.label}`}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          {period.label}
        </Text>
        <AmountText amountPaise={report.netPaise} size="large" colorBySign />

        <View style={[styles.row, { gap: theme.spacing.xl, marginTop: theme.spacing.md }]}>
          <Figure label="In" amountPaise={report.incomePaise} />
          <Figure label="Out" amountPaise={-report.expensePaise} />
        </View>

        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, marginTop: theme.spacing.sm },
          ]}
        >
          {formatINR(report.dailyAveragePaise, { withDecimals: false })} a day on average over{' '}
          {report.days} {report.days === 1 ? 'day' : 'days'}.
        </Text>
      </Card>

      {!hasAnything ? (
        <EmptyState
          icon="bar-chart-outline"
          title="Nothing to report yet"
          description="Add a few transactions and this fills up with where your money went."
          actionLabel="Add a transaction"
          onAction={() => router.push('/(tabs)/add')}
        />
      ) : null}

      <Section title="Where it went">
        {hasSpend ? (
          <Card>
            <SpendDonut
              slices={report.slices}
              totalPaise={report.expensePaise}
              summary={describeCategoryChart(report.slices, report.expensePaise, period.label)}
              testID="spend-donut"
            />
            <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
              {report.slices.map((slice) => (
                <SliceRow
                  key={slice.key}
                  slice={slice}
                  onPress={
                    slice.isOther
                      ? undefined
                      : () =>
                          router.push({
                            pathname: '/reports/category/[id]',
                            params: {
                              id: slice.categoryId ?? 'uncategorised',
                              from: period.from,
                              to: period.to,
                              name: slice.name,
                              label: period.label,
                            },
                          })
                  }
                />
              ))}
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              No spending in {period.label}.
            </Text>
          </Card>
        )}
      </Section>

      <Section title="Income and expense">
        {report.trend.length > 0 ? (
          <Card>
            <TrendBars
              points={report.trend}
              summary={describeTrendChart(report.trend, period.label)}
              testID="trend-bars"
            />
            {report.trendIsTrimmed ? (
              // The figures above cover the whole period; the chart cannot
              // draw sixty legible bars, so it says which months it drew
              // rather than quietly ending two years early.
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textMuted, marginTop: theme.spacing.sm },
                ]}
              >
                Showing the most recent {report.trend.length} months. The figures above cover the
                whole period.
              </Text>
            ) : null}
          </Card>
        ) : null}
      </Section>

      {report.changes.length > 0 ? (
        <Section title="Compared with the period before">
          <Card padded={false}>
            <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
              {report.changes.slice(0, 6).map((change) => (
                <ChangeRow key={change.categoryId ?? 'uncategorised'} change={change} />
              ))}
            </View>
          </Card>
        </Section>
      ) : null}

      {report.topExpenses.length > 0 ? (
        <Section title="Biggest expenses">
          <Card padded={false}>
            <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
              {report.topExpenses.map((expense) => (
                <View
                  key={expense.id}
                  style={styles.row}
                  accessible
                  accessibilityLabel={`${expense.note || expense.categoryName}, ${formatINR(
                    expense.amountPaise,
                  )}, ${new Date(expense.occurredAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}`}
                >
                  <CategoryIcon glyph={expense.icon ?? undefined} />
                  <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                    <Text
                      numberOfLines={1}
                      style={[theme.typography.bodyStrong, { color: theme.colors.text }]}
                    >
                      {expense.note || expense.categoryName}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                      {expense.categoryName} ·{' '}
                      {new Date(expense.occurredAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                  <AmountText amountPaise={expense.amountPaise} size="small" />
                </View>
              ))}
            </View>
          </Card>
        </Section>
      ) : null}

      <Button
        label="Export CSV"
        variant="secondary"
        fullWidth
        loading={isExporting}
        onPress={() => void handleExport()}
        leading={<Ionicons name="download-outline" size={18} color={theme.colors.text} />}
        accessibilityLabel={`Export ${period.label} as a CSV file`}
      />

      {picking ? (
        <DateTimePicker
          value={(picking === 'end' ? customStart : null) ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          minimumDate={picking === 'end' ? (customStart ?? undefined) : undefined}
          onChange={(event, date) =>
            handleDate(picking, event.type === 'dismissed' ? undefined : date)
          }
        />
      ) : null}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  if (!children) {
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
      {children}
    </View>
  );
}

function Figure({ label, amountPaise }: { label: string; amountPaise: number }) {
  const theme = useTheme();
  return (
    <View>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{label}</Text>
      <AmountText amountPaise={amountPaise} size="small" colorBySign />
    </View>
  );
}

function SliceRow({ slice, onPress }: { slice: CategorySlice; onPress?: () => void }) {
  const theme = useTheme();

  const label = slice.isOther
    ? `Other, ${slice.foldedCount} smaller categories, ${formatINR(slice.amountPaise)}, ${Math.round(
        slice.sharePercent,
      )}% of spending`
    : `${slice.name}, ${formatINR(slice.amountPaise)}, ${Math.round(slice.sharePercent)}% of spending`;

  const content = (
    <View style={[styles.row, styles.sliceRow]}>
      {/* The swatch ties the row to its slice; the name and the number mean
          the colour is never the only thing carrying the identity. */}
      <View style={[styles.swatch, { backgroundColor: slice.color }]} />
      <CategoryIcon glyph={slice.icon ?? undefined} />
      <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
        <Text numberOfLines={1} style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
          {slice.isOther ? `Other (${slice.foldedCount})` : slice.name}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          {slice.sharePercent}% · {slice.txnCount} {slice.txnCount === 1 ? 'entry' : 'entries'}
        </Text>
      </View>
      <AmountText amountPaise={slice.amountPaise} size="small" />
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the transactions in this category"
      hitSlop={8}
    >
      {content}
    </Pressable>
  );
}

function ChangeRow({ change }: { change: CategoryChange }) {
  const theme = useTheme();

  const tone =
    change.direction === 'up'
      ? theme.colors.expense
      : change.direction === 'down'
        ? theme.colors.income
        : theme.colors.textMuted;

  const glyph =
    change.direction === 'up'
      ? 'arrow-up-circle'
      : change.direction === 'down'
        ? 'arrow-down-circle'
        : 'remove-circle-outline';

  return (
    <View style={styles.row} accessible accessibilityLabel={describeCategoryChange(change)}>
      <CategoryIcon glyph={change.icon ?? undefined} />
      <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
        <Text numberOfLines={1} style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
          {change.name}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          was {formatINR(change.previousPaise, { withDecimals: false })}
        </Text>
      </View>
      <View style={styles.change}>
        {/* The arrow never travels alone: the number beside it says the same
            thing for anyone who cannot pick the colour out. */}
        <Ionicons name={glyph} size={16} color={tone} />
        <Text style={[theme.typography.bodyStrong, { color: tone }]}>
          {change.isNew
            ? 'new'
            : change.changePercent === null
              ? formatINR(change.deltaPaise, { withDecimals: false, signDisplay: 'always' })
              : `${change.changePercent > 0 ? '+' : ''}${change.changePercent}%`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  sliceRow: { minHeight: 44 },
  swatch: { width: 8, height: 32, borderRadius: 4, marginRight: 8 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
