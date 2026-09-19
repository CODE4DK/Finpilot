import { periodTotals, type BalanceTransaction, type PeriodTotals } from './balances';
import { formatDayHeading, toLocalDayKey } from './period';

/**
 * Grouping the transaction list by local day, with a total per day. The list
 * is long and scrolled hard, so this produces a flat array of section headers
 * and rows - the shape FlashList renders fastest.
 */

export interface DayGroupTransaction extends BalanceTransaction {
  id: string;
  occurred_at: string;
  created_at?: string;
}

export interface DayGroup<T extends DayGroupTransaction> {
  dayKey: string;
  heading: string;
  transactions: T[];
  totals: PeriodTotals;
}

export function groupByDay<T extends DayGroupTransaction>(
  transactions: readonly T[],
  now: Date = new Date(),
): DayGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const transaction of transactions) {
    if (transaction.deleted_at) {
      continue;
    }
    const dayKey = toLocalDayKey(new Date(transaction.occurred_at));
    const existing = groups.get(dayKey);
    if (existing) {
      existing.push(transaction);
    } else {
      groups.set(dayKey, [transaction]);
    }
  }

  return (
    [...groups.entries()]
      // Newest day first; within a day, newest transaction first.
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([dayKey, rows]) => ({
        dayKey,
        heading: formatDayHeading(dayKey, now),
        transactions: [...rows].sort(compareByRecency),
        totals: periodTotals(rows),
      }))
  );
}

function compareByRecency<T extends DayGroupTransaction>(a: T, b: T): number {
  if (a.occurred_at !== b.occurred_at) {
    return a.occurred_at < b.occurred_at ? 1 : -1;
  }
  // Same instant - fall back to insertion order so the list is stable.
  const aCreated = a.created_at ?? '';
  const bCreated = b.created_at ?? '';
  return aCreated < bCreated ? 1 : aCreated > bCreated ? -1 : 0;
}

export type ListItem<T extends DayGroupTransaction> =
  | { kind: 'header'; dayKey: string; heading: string; totals: PeriodTotals }
  | { kind: 'transaction'; dayKey: string; transaction: T };

/** Flattens the groups for a virtualised list. */
export function toListItems<T extends DayGroupTransaction>(
  groups: readonly DayGroup<T>[],
): ListItem<T>[] {
  return groups.flatMap<ListItem<T>>((group) => [
    { kind: 'header', dayKey: group.dayKey, heading: group.heading, totals: group.totals },
    ...group.transactions.map(
      (transaction) => ({ kind: 'transaction', dayKey: group.dayKey, transaction }) as const,
    ),
  ]);
}

/** FlashList wants a stable key per row. */
export function listItemKey<T extends DayGroupTransaction>(item: ListItem<T>): string {
  return item.kind === 'header' ? `header:${item.dayKey}` : `row:${item.transaction.id}`;
}
