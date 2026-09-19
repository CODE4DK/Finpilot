import {
  DEFAULT_RECENT_LIMIT,
  canArchiveCategory,
  canDeleteCategory,
  describeDeleteBlock,
  orderCategories,
  type OrderableCategory,
  type UsageRecord,
} from '@/features/categories/ordering';

function category(id: string, name: string, overrides: Partial<OrderableCategory> = {}) {
  return { id, name, type: 'expense', ...overrides };
}

const CATEGORIES = [
  category('food', 'Food'),
  category('groceries', 'Groceries'),
  category('rent', 'Rent'),
  category('transport', 'Transport'),
  category('bills', 'Bills & Utilities'),
];

function usage(id: string, lastUsedAt: string, uses = 1): UsageRecord {
  return { category_id: id, last_used_at: lastUsedAt, uses };
}

describe('orderCategories', () => {
  it('sorts alphabetically when nothing has been used', () => {
    expect(orderCategories(CATEGORIES).map((c) => c.name)).toEqual([
      'Bills & Utilities',
      'Food',
      'Groceries',
      'Rent',
      'Transport',
    ]);
  });

  it('floats recently used categories to the top, most recent first', () => {
    const ordered = orderCategories(CATEGORIES, [
      usage('rent', '2026-09-19T10:00:00.000Z'),
      usage('transport', '2026-09-18T10:00:00.000Z'),
    ]);

    expect(ordered.map((c) => c.id).slice(0, 2)).toEqual(['rent', 'transport']);
  });

  it('keeps the remainder alphabetical behind the recent ones', () => {
    const ordered = orderCategories(CATEGORIES, [usage('rent', '2026-09-19T10:00:00.000Z')]);

    expect(ordered.map((c) => c.name)).toEqual([
      'Rent',
      'Bills & Utilities',
      'Food',
      'Groceries',
      'Transport',
    ]);
  });

  it('breaks a tie on the same timestamp by frequency of use', () => {
    const ordered = orderCategories(CATEGORIES, [
      usage('food', '2026-09-19T10:00:00.000Z', 2),
      usage('rent', '2026-09-19T10:00:00.000Z', 9),
    ]);

    expect(ordered[0]!.id).toBe('rent');
  });

  it('caps how many recent categories jump the queue', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      category(`c${index}`, `Category ${index}`),
    );
    const recent = many.map((c, index) =>
      usage(c.id, new Date(2026, 8, 19, 10, 60 - index).toISOString()),
    );

    const ordered = orderCategories(many, recent, { recentLimit: 3 });

    // The first three are in usage order; the rest revert to alphabetical.
    expect(ordered.slice(0, 3).map((c) => c.id)).toEqual(['c0', 'c1', 'c2']);
    expect(ordered.slice(3).map((c) => c.name)).toEqual(
      [...ordered.slice(3)].map((c) => c.name).sort(),
    );
  });

  it('defaults to six recent categories - one grid row', () => {
    expect(DEFAULT_RECENT_LIMIT).toBe(6);
  });

  it('ignores usage of a category that no longer exists', () => {
    const ordered = orderCategories(CATEGORIES, [usage('deleted-one', '2026-09-19T10:00:00.000Z')]);
    expect(ordered).toHaveLength(CATEGORIES.length);
  });

  it('ignores usage rows with no category, as a transfer has', () => {
    const ordered = orderCategories(CATEGORIES, [
      { category_id: null, last_used_at: '2026-09-19T10:00:00.000Z', uses: 5 },
      usage('rent', '2026-09-18T10:00:00.000Z'),
    ]);

    expect(ordered[0]!.id).toBe('rent');
  });

  it('excludes soft-deleted categories', () => {
    const withDeleted = [...CATEGORIES, category('old', 'Old', { deleted_at: '2026-09-01' })];
    expect(orderCategories(withDeleted).map((c) => c.id)).not.toContain('old');
  });

  it('sorts case-insensitively', () => {
    const mixed = [category('a', 'zebra'), category('b', 'Apple')];
    expect(orderCategories(mixed).map((c) => c.name)).toEqual(['Apple', 'zebra']);
  });

  it('handles an empty list', () => {
    expect(orderCategories([])).toEqual([]);
  });
});

describe('deleting and archiving', () => {
  const custom = category('custom', 'Chai', { is_default: 0 });
  const seeded = category('food', 'Food', { is_default: 1 });

  it('allows deleting a custom category', () => {
    expect(canDeleteCategory(custom)).toBe(true);
    expect(describeDeleteBlock(custom)).toBeNull();
  });

  it('refuses to delete a seeded default', () => {
    expect(canDeleteCategory(seeded)).toBe(false);
  });

  it('explains the refusal and offers archiving instead', () => {
    const message = describeDeleteBlock(seeded);
    expect(message).toContain('built-in');
    expect(message).toContain('archive');
  });

  it('allows archiving either kind', () => {
    expect(canArchiveCategory(custom)).toBe(true);
    expect(canArchiveCategory(seeded)).toBe(true);
  });

  it('does not offer to archive something already gone', () => {
    expect(canArchiveCategory(category('x', 'X', { deleted_at: '2026-09-01' }))).toBe(false);
  });
});
