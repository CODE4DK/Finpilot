import type { Tables, TablesInsert } from '@/db';
import type { AccountType, TransactionType } from '@/db/enums';

/**
 * Compile-time checks on the generated types. There is no runtime behaviour to
 * assert here - the value of the test is that `npm run typecheck` fails if a
 * regeneration drops a column or changes a nullability.
 */
describe('generated database types', () => {
  it('describes a transaction row', () => {
    const row: Tables<'transactions'> = {
      id: 'e8b1c1d0-0000-4000-8000-000000000001',
      user_id: 'e8b1c1d0-0000-4000-8000-000000000002',
      type: 'expense' satisfies TransactionType,
      amount_paise: 184550,
      account_id: 'e8b1c1d0-0000-4000-8000-000000000003',
      to_account_id: null,
      category_id: 'e8b1c1d0-0000-4000-8000-000000000004',
      note: 'Groceries',
      occurred_at: '2026-09-19T10:00:00.000Z',
      recurring_rule_id: null,
      created_at: '2026-09-19T10:00:00.000Z',
      updated_at: '2026-09-19T10:00:00.000Z',
      deleted_at: null,
    };

    expect(row.amount_paise).toBe(184550);
    // Money crosses the wire as an integer, never a float.
    expect(Number.isSafeInteger(row.amount_paise)).toBe(true);
  });

  it('makes server-defaulted columns optional on insert', () => {
    // No created_at/updated_at/deleted_at, and no id - but the client supplies
    // the id in practice, which is why it is allowed rather than required.
    const insert: TablesInsert<'accounts'> = {
      id: 'e8b1c1d0-0000-4000-8000-000000000005',
      user_id: 'e8b1c1d0-0000-4000-8000-000000000002',
      type: 'upi_wallet' satisfies AccountType,
      name: 'PhonePe',
    };

    expect(insert.name).toBe('PhonePe');
  });

  it('types money columns as numbers of paise', () => {
    const budget: TablesInsert<'budgets'> = {
      user_id: 'e8b1c1d0-0000-4000-8000-000000000002',
      category_id: 'e8b1c1d0-0000-4000-8000-000000000004',
      month: '2026-09-01',
      limit_paise: 1000000,
    };
    const goal: TablesInsert<'goals'> = {
      user_id: 'e8b1c1d0-0000-4000-8000-000000000002',
      name: 'Emergency fund',
      target_paise: 50000000,
    };

    expect(budget.limit_paise + goal.target_paise).toBe(51000000);
  });

  it('carries the soft-delete and ownership columns on every table', () => {
    const profile: Tables<'profiles'> = {
      id: 'e8b1c1d0-0000-4000-8000-000000000002',
      user_id: 'e8b1c1d0-0000-4000-8000-000000000002',
      full_name: null,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      onboarding_completed: false,
      ai_insights_opt_in: false,
      created_at: '2026-09-19T10:00:00.000Z',
      updated_at: '2026-09-19T10:00:00.000Z',
      deleted_at: null,
    };

    expect(profile.currency).toBe('INR');
    expect(profile.ai_insights_opt_in).toBe(false);
  });
});
