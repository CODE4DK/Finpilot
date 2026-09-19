/**
 * Ordering the category grid.
 *
 * The grid is the one tap between a typed amount and a saved expense, so the
 * category the user is most likely to want has to be within thumb reach.
 * Recently used comes first, then the rest alphabetically.
 */

export interface OrderableCategory {
  id: string;
  name: string;
  type: string;
  is_default?: number | boolean;
  deleted_at?: string | null;
}

export interface UsageRecord {
  category_id: string | null;
  /** ISO-8601 of the most recent use. */
  last_used_at: string;
  /** How many times it has been used in the window. */
  uses: number;
}

export interface OrderOptions {
  /** How many recent categories to float to the top. */
  recentLimit?: number;
}

export const DEFAULT_RECENT_LIMIT = 6;

/**
 * Sorts categories: most recently used first (up to `recentLimit`), then the
 * remainder alphabetically, case-insensitively.
 */
export function orderCategories<T extends OrderableCategory>(
  categories: readonly T[],
  usage: readonly UsageRecord[] = [],
  options: OrderOptions = {},
): T[] {
  const { recentLimit = DEFAULT_RECENT_LIMIT } = options;

  const live = categories.filter((category) => !category.deleted_at);

  const rank = new Map<string, number>();
  [...usage]
    .filter((record): record is UsageRecord & { category_id: string } =>
      Boolean(record.category_id),
    )
    .sort((a, b) => {
      if (a.last_used_at !== b.last_used_at) {
        return a.last_used_at < b.last_used_at ? 1 : -1;
      }
      return b.uses - a.uses;
    })
    .slice(0, recentLimit)
    .forEach((record, index) => rank.set(record.category_id, index));

  const recent = live
    .filter((category) => rank.has(category.id))
    .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);

  const rest = live
    .filter((category) => !rank.has(category.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'en-IN', { sensitivity: 'base' }));

  return [...recent, ...rest];
}

/** How many of the ordered list came from recent usage. */
export function recentCount<T extends OrderableCategory>(
  ordered: readonly T[],
  usage: readonly UsageRecord[],
  options: OrderOptions = {},
): number {
  const { recentLimit = DEFAULT_RECENT_LIMIT } = options;
  const recentIds = new Set(
    usage
      .filter((record) => record.category_id)
      .slice(0, recentLimit)
      .map((record) => record.category_id),
  );
  return ordered.filter((category) => recentIds.has(category.id)).length;
}

/**
 * Whether a category may be deleted. Seeded defaults never can - they are
 * referenced by the onboarding copy and by a user's muscle memory - but they
 * can be archived, which hides them without breaking historical rows.
 */
export function canDeleteCategory(category: OrderableCategory): boolean {
  return !category.is_default;
}

export function canArchiveCategory(category: OrderableCategory): boolean {
  return !category.deleted_at;
}

/** Explains a blocked delete to the user. */
export function describeDeleteBlock(category: OrderableCategory): string | null {
  if (canDeleteCategory(category)) {
    return null;
  }
  return `${category.name} is a built-in category. You can archive it instead, which hides it without changing past transactions.`;
}
