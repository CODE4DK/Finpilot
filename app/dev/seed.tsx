import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, ProgressBar, Screen, useToast } from '@/components';
import { useAccounts, useCategories } from '@/db/hooks';
import { getPowerSync } from '@/db/powersync';
import { useAuthStore } from '@/features/auth';
import {
  DEFAULT_SEED_COUNT,
  buildSeedTransactions,
  toBatches,
  type SeedTransaction,
} from '@/features/dev/seed-data';
import { useTheme } from '@/theme';

/**
 * Seeds a development build with a realistic ledger, so the list, the reports
 * and the charts can be judged at a size a real user reaches - not with the
 * dozen rows a developer types by hand.
 *
 * Development builds only: the whole /dev group redirects home when `__DEV__`
 * is false.
 */
export default function SeedScreen() {
  const theme = useTheme();
  const toast = useToast();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const accounts = useAccounts();
  const categories = useCategories('expense');

  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  const seed = async () => {
    if (!userId || accounts.data.length === 0) {
      toast.show('Create an account first', { tone: 'warning' });
      return;
    }

    setRunning(true);
    setProgress(0);

    try {
      const rows = buildSeedTransactions({
        accountIds: accounts.data.map((account) => account.id),
        categoryIds: categories.data.map((category) => category.id),
        count: DEFAULT_SEED_COUNT,
      });

      const batches = toBatches(rows);
      const db = getPowerSync();

      for (const [index, batch] of batches.entries()) {
        // One transaction per batch: 10,000 individual statements each with
        // their own commit is minutes of work on a mid-range Android.
        await db.writeTransaction(async (tx) => {
          for (const row of batch) {
            await tx.execute(INSERT_SQL, toParameters(row, userId));
          }
        });
        setProgress((index + 1) / batches.length);
      }

      toast.show(`Seeded ${rows.length.toLocaleString('en-IN')} transactions`, {
        tone: 'success',
      });
    } catch {
      toast.show('Seeding failed', { tone: 'error' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Screen accessibilityLabel="Seed data screen" scrollable>
      <Card accessibilityLabel="Seed development data">
        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
          Seed {DEFAULT_SEED_COUNT.toLocaleString('en-IN')} transactions
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
          ]}
        >
          Three years of a plausible ledger across your accounts and categories, written straight
          into the local database. It syncs like anything else, so do this on a throwaway account.
        </Text>

        {running ? (
          <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
            <ProgressBar
              progress={progress}
              accessibilityLabel={`Seeding, ${Math.round(progress * 100)}% done`}
            />
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: theme.spacing.lg }}>
          <Button
            label="Seed data"
            fullWidth
            loading={running}
            onPress={() => void seed()}
            leading={<Ionicons name="flask-outline" size={18} color={theme.colors.onPrimary} />}
            accessibilityLabel={`Seed ${DEFAULT_SEED_COUNT} development transactions`}
          />
        </View>
      </Card>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        With this loaded, the transactions list pages 200 rows at a time and the reports aggregate
        in SQL - neither pulls the whole ledger into JavaScript.
      </Text>
    </Screen>
  );
}

const COLUMNS = [
  'id',
  'user_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'type',
  'amount_paise',
  'account_id',
  'to_account_id',
  'category_id',
  'note',
  'occurred_at',
  'recurring_rule_id',
];

const INSERT_SQL = `INSERT OR IGNORE INTO transactions (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(
  () => '?',
).join(', ')})`;

function toParameters(row: SeedTransaction, userId: string): unknown[] {
  return [
    row.id,
    userId,
    row.created_at,
    row.updated_at,
    row.deleted_at,
    row.type,
    row.amount_paise,
    row.account_id,
    row.to_account_id,
    row.category_id,
    row.note,
    row.occurred_at,
    null,
  ];
}
