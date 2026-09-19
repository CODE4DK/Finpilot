import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AmountInput,
  AmountText,
  BottomSheet,
  Button,
  Card,
  CategoryIcon,
  Chip,
  EmptyState,
  ListItem,
  ProgressBar,
  ProgressRing,
  Screen,
  Skeleton,
  SkeletonList,
  TabBarAddButton,
  TextInput,
  useToast,
} from '@/components';
import { CATEGORY_ICONS, type CategoryKey } from '@/components/category-icon';
import { selectThemePreference, useSettingsStore } from '@/stores/settings-store';
import { useTheme, type ThemePreference } from '@/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text
        accessibilityRole="header"
        style={[theme.typography.overline, { color: theme.colors.textMuted }]}
      >
        {title.toUpperCase()}
      </Text>
      <Card>
        <View style={{ gap: theme.spacing.md }}>{children}</View>
      </Card>
    </View>
  );
}

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

/** A live catalogue of the design system. Development builds only. */
export default function ComponentGalleryScreen() {
  const theme = useTheme();
  const toast = useToast();
  const preference = useSettingsStore(selectThemePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);

  const [text, setText] = useState('');
  const [amountPaise, setAmountPaise] = useState<number | null>(125000);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedChip, setSelectedChip] = useState('Food');

  return (
    <Screen accessibilityLabel="Component gallery screen" scrollable testID="component-gallery">
      <Section title="Theme">
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          {THEME_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={preference === option}
              onPress={() => setThemePreference(option)}
              accessibilityLabel={`Use ${option} theme`}
            />
          ))}
        </View>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          Rendering the {theme.scheme} scheme.
        </Text>
      </Section>

      <Section title="Typography">
        {(['display', 'title', 'heading', 'subheading', 'body', 'label', 'caption'] as const).map(
          (variant) => (
            <Text key={variant} style={[theme.typography[variant], { color: theme.colors.text }]}>
              {variant}
            </Text>
          ),
        )}
      </Section>

      <Section title="Colors">
        <View style={[styles.row, styles.wrap, { gap: theme.spacing.sm }]}>
          {(['primary', 'accent', 'income', 'expense', 'warning', 'info'] as const).map((token) => (
            <View key={token} style={{ alignItems: 'center', gap: theme.spacing.xxs }}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: theme.colors[token], borderRadius: theme.radius.sm },
                ]}
              />
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                {token}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Buttons">
        {(['primary', 'secondary', 'tertiary', 'destructive'] as const).map((variant) => (
          <Button key={variant} label={variant} variant={variant} onPress={() => {}} />
        ))}
        <Button label="Loading" loading onPress={() => {}} />
        <Button label="Disabled" disabled onPress={() => {}} />
        <Button label="Small" size="sm" onPress={() => {}} />
        <Button label="Large, full width" size="lg" fullWidth onPress={() => {}} />
      </Section>

      <Section title="Inputs">
        <TextInput label="Text input" value={text} onChangeText={setText} placeholder="Type here" />
        <TextInput label="With hint" hint="Helper copy" value="" onChangeText={() => {}} />
        <TextInput label="With error" error="Something is wrong" value="" onChangeText={() => {}} />
        <AmountInput label="Amount" valuePaise={amountPaise} onChangePaise={setAmountPaise} />
      </Section>

      <Section title="Amounts">
        <AmountText amountPaise={12345678} size="large" />
        <AmountText amountPaise={-245600} colorBySign />
        <AmountText amountPaise={845600} colorBySign size="small" />
        <AmountText amountPaise={1_25_000_00} formatOptions={{ compact: true }} />
      </Section>

      <Section title="Chips">
        <View style={[styles.row, styles.wrap, { gap: theme.spacing.sm }]}>
          {['Food', 'Transport', 'Bills'].map((label) => (
            <Chip
              key={label}
              label={label}
              selected={selectedChip === label}
              onPress={() => setSelectedChip(label)}
            />
          ))}
          <Chip label="Income" tone="income" />
          <Chip label="Expense" tone="expense" />
          <Chip label="Disabled" disabled onPress={() => {}} />
        </View>
      </Section>

      <Section title="List items">
        <ListItem
          title="Big Bazaar"
          subtitle="Groceries · Today"
          leading={<CategoryIcon category="groceries" />}
          trailing={<AmountText amountPaise={-184550} size="small" colorBySign />}
          onPress={() => {}}
          showDivider
        />
        <ListItem
          title="Salary"
          subtitle="Income · 1 Sep"
          leading={<CategoryIcon category="salary" color={theme.colors.income} />}
          trailing={<AmountText amountPaise={8500000} size="small" colorBySign />}
          onPress={() => {}}
        />
      </Section>

      <Section title="Category icons">
        <View style={[styles.row, styles.wrap, { gap: theme.spacing.sm }]}>
          {(Object.keys(CATEGORY_ICONS) as CategoryKey[]).map((key) => (
            <CategoryIcon key={key} category={key} />
          ))}
        </View>
      </Section>

      <Section title="Progress">
        <ProgressBar progress={0.35} label="35%" />
        <ProgressBar progress={0.85} autoTone label="85% (auto tone)" />
        <ProgressBar progress={1.2} autoTone label="Over budget" />
        <View style={styles.center}>
          <ProgressRing progress={0.62}>
            <Text style={[theme.typography.heading, { color: theme.colors.text }]}>62%</Text>
          </ProgressRing>
        </View>
      </Section>

      <Section title="Loading">
        <Skeleton width="80%" />
        <Skeleton width="55%" />
        <SkeletonList rows={2} />
      </Section>

      <Section title="Feedback">
        <Button
          label="Show success toast"
          onPress={() => toast.show('Saved', { tone: 'success' })}
        />
        <Button
          label="Show error toast"
          variant="destructive"
          onPress={() => toast.show('Could not sync', { tone: 'error' })}
        />
        <Button label="Open bottom sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
      </Section>

      <Section title="Empty state">
        <EmptyState
          icon="wallet-outline"
          title="Nothing here yet"
          description="Empty states carry an icon, a title, a line of copy and one action."
          actionLabel="Do the thing"
          onAction={() => toast.show('Action tapped')}
        />
      </Section>

      <Section title="Tab bar add button">
        <View style={styles.center}>
          <TabBarAddButton onPress={() => toast.show('Add tapped')} />
        </View>
      </Section>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="A bottom sheet">
        <View style={{ gap: theme.spacing.md }}>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Sheets are used for pickers and quick forms.
          </Text>
          <Button label="Close" onPress={() => setSheetOpen(false)} fullWidth />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  swatch: {
    height: 40,
    width: 40,
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
