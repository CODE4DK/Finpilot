/**
 * Development seed data.
 *
 * Ten thousand transactions is not a stress test for its own sake: it is
 * roughly eight years of a real user's spending, and it is the point at which
 * "map everything into JavaScript and group it" stops being free. The list
 * and the reports have to stay smooth with this loaded.
 *
 * The generator is pure and seeded, so two runs produce the same ledger and a
 * performance number means something between runs. It is `__DEV__`-only by
 * where it is used - `app/dev/seed.tsx` - not by what it is: a pure function
 * is also what the performance test feeds.
 */

import { TRANSACTION_TYPES, type TransactionType } from '@/db/enums';

export interface SeedTransaction {
  id: string;
  type: TransactionType;
  amount_paise: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SeedOptions {
  accountIds: string[];
  categoryIds: string[];
  count?: number;
  /** The newest transaction; the rest walk backwards from here. */
  now?: Date;
  /** How far back the ledger stretches. */
  days?: number;
  seed?: number;
}

export const DEFAULT_SEED_COUNT = 10_000;

/**
 * A small deterministic PRNG (mulberry32). `Math.random` would make every run
 * a different dataset, and a benchmark you cannot repeat is an anecdote.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic v4-shaped id, so seeded rows look like real ones. */
export function seededId(random: () => number): string {
  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(random() * 16).toString(16)).join('');
  const variant = ((Math.floor(random() * 4) + 8) & 0xf).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

/** Realistic-ish amounts: mostly small, occasionally a rent-sized one. */
function amountFor(type: TransactionType, random: () => number): number {
  if (type === 'income') {
    return Math.round((40000 + random() * 60000) * 100);
  }
  if (type === 'transfer') {
    return Math.round((1000 + random() * 20000) * 100);
  }
  const roll = random();
  if (roll > 0.97) {
    return Math.round((15000 + random() * 25000) * 100);
  }
  if (roll > 0.85) {
    return Math.round((1000 + random() * 4000) * 100);
  }
  return Math.round((50 + random() * 900) * 100);
}

const NOTES = [
  'Groceries',
  'Auto fare',
  'Chai',
  'Electricity bill',
  'Dinner out',
  'Recharge',
  'Medicines',
  null,
];

export function buildSeedTransactions({
  accountIds,
  categoryIds,
  count = DEFAULT_SEED_COUNT,
  now = new Date(),
  days = 365 * 3,
  seed = 20260919,
}: SeedOptions): SeedTransaction[] {
  if (accountIds.length === 0) {
    throw new Error('Seeding needs at least one account');
  }

  const random = createRandom(seed);
  const rows: SeedTransaction[] = [];
  const spanMs = days * 24 * 60 * 60 * 1000;

  for (let index = 0; index < count; index += 1) {
    const roll = random();
    // Roughly what a ledger looks like: mostly expenses, a monthly salary,
    // the occasional transfer.
    const type: TransactionType = roll > 0.97 ? 'transfer' : roll > 0.92 ? 'income' : 'expense';

    const occurredAt = new Date(now.getTime() - Math.floor(random() * spanMs));
    const accountIndex = Math.floor(random() * accountIds.length);
    const toAccountIndex = (accountIndex + 1) % accountIds.length;

    rows.push({
      id: seededId(random),
      type,
      amount_paise: amountFor(type, random),
      account_id: accountIds[accountIndex]!,
      to_account_id: type === 'transfer' ? (accountIds[toAccountIndex] ?? null) : null,
      category_id:
        type === 'transfer' || categoryIds.length === 0
          ? null
          : (categoryIds[Math.floor(random() * categoryIds.length)] ?? null),
      note: NOTES[Math.floor(random() * NOTES.length)] ?? null,
      occurred_at: occurredAt.toISOString(),
      created_at: occurredAt.toISOString(),
      updated_at: occurredAt.toISOString(),
      deleted_at: null,
    });
  }

  return rows.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
}

/** Rows are inserted in batches; one 10,000-row statement is not a plan. */
export const INSERT_BATCH_SIZE = 250;

export function toBatches<T>(rows: readonly T[], size = INSERT_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    batches.push(rows.slice(index, index + size));
  }
  return batches;
}

/** Guard: nothing here may ever run against a real user's ledger by accident. */
export function assertSeedable(transactionTypes: readonly string[] = TRANSACTION_TYPES): void {
  if (!__DEV__) {
    throw new Error('Seed data is a development-only feature');
  }
  if (transactionTypes.length === 0) {
    throw new Error('No transaction types to seed');
  }
}
