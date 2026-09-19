import { Ionicons } from '@expo/vector-icons';
import { Switch, Text, View } from 'react-native';

import {
  AmountText,
  Card,
  CategoryIcon,
  EmptyState,
  ListItem,
  Screen,
  SwipeRow,
  useToast,
} from '@/components';
import {
  useAccounts,
  useCategories,
  useRecurringRules,
  useRecurringRulesRepository,
} from '@/db/hooks';
import { describeRecurrence } from '@/features/recurring/schedule';
import { useTheme } from '@/theme';

export default function RecurringScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { data: rules } = useRecurringRules();
  const repository = useRecurringRulesRepository();
  const accounts = useAccounts();
  const categories = useCategories();

  const categoryFor = (id: string | null) =>
    id ? categories.data.find((category) => category.id === id) : null;
  const accountName = (id: string) =>
    accounts.data.find((account) => account.id === id)?.name ?? 'Account';

  const setActive = async (id: string, active: boolean) => {
    if (!repository) {
      return;
    }
    await repository.setActive(id, active);
    toast.show(active ? 'Repeat resumed' : 'Repeat paused');
  };

  const remove = async (rule: (typeof rules)[number]) => {
    if (!repository) {
      return;
    }
    await repository.remove(rule.id);
    // Deleting the rule leaves the transactions it already generated alone -
    // they happened.
    toast.show('Repeat deleted. Past entries are kept.', { tone: 'info' });
  };

  if (rules.length === 0) {
    return (
      <Screen accessibilityLabel="Repeating transactions screen">
        <EmptyState
          icon="repeat-outline"
          title="Nothing repeats yet"
          description="Turn on Repeat when adding a transaction — rent, a subscription, a salary — and it will be created for you."
        />
      </Screen>
    );
  }

  return (
    <Screen accessibilityLabel="Repeating transactions screen" scrollable>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          {rules.map((rule, index) => {
            const category = categoryFor(rule.category_id);
            const nextRun = new Date(rule.next_run_at);

            return (
              <SwipeRow
                key={rule.id}
                testID={`swipe-rule-${rule.id}`}
                rightActions={[
                  {
                    label: 'Delete',
                    icon: 'trash-outline',
                    tone: 'expense',
                    onPress: () => void remove(rule),
                  },
                ]}
              >
                <ListItem
                  title={rule.note?.trim() || category?.name || 'Transfer'}
                  subtitle={`${describeRecurrence(
                    rule.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
                    rule.interval,
                    nextRun.getDate(),
                  )} · ${accountName(rule.account_id)}${
                    rule.is_active === 1
                      ? ` · Next ${nextRun.toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}`
                      : ' · Paused'
                  }`}
                  leading={
                    rule.type === 'transfer' ? (
                      <CategoryIcon glyph="swap-horizontal-outline" />
                    ) : (
                      <CategoryIcon glyph={category?.icon} color={category?.color ?? undefined} />
                    )
                  }
                  trailing={
                    <View style={{ alignItems: 'flex-end', gap: theme.spacing.xxs }}>
                      <AmountText
                        amountPaise={
                          rule.type === 'income' ? rule.amount_paise : -rule.amount_paise
                        }
                        size="small"
                        colorBySign={rule.type !== 'transfer'}
                      />
                      <Switch
                        accessibilityLabel={`${rule.is_active === 1 ? 'Pause' : 'Resume'} this repeat`}
                        value={rule.is_active === 1}
                        onValueChange={(next) => void setActive(rule.id, next)}
                      />
                    </View>
                  }
                  showDivider={index < rules.length - 1}
                />
              </SwipeRow>
            );
          })}
        </View>
      </Card>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        Repeating transactions are created when you open FinPilot, including any that fell due while
        it was closed. Each one is created exactly once, even across devices.
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Ionicons name="information-circle-outline" size={18} color={theme.colors.textMuted} />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, flex: 1 }]}>
          Deleting a repeat keeps the transactions it already created.
        </Text>
      </View>
    </Screen>
  );
}
