/**
 * The payload builder.
 *
 * This is the privacy boundary of the whole feature. Everything that leaves
 * the device passes through here, and the rule is simple: **aggregates and
 * category names only**. No transaction notes, no account names, no merchant
 * strings, no ids, no email, no full name. A note is where people write
 * "loan to Ravi" or a card's last four digits, and an account name is
 * identifying on its own.
 *
 * Deliberately free of Deno and Supabase imports so the leak test can run in
 * the app's Jest suite - see `__tests__/payload.test.ts`. The Edge Function
 * reads the rows and hands them here; this module never touches a database.
 */

export interface CategoryTotalRow {
  category_name: string | null;
  spent_paise: number;
  txn_count: number;
}

export interface MonthTotalsRow {
  income_paise: number;
  expense_paise: number;
  expense_count: number;
}

export interface BudgetRow {
  category_name: string | null;
  limit_paise: number;
  spent_paise: number;
}

export interface GoalRow {
  name: string;
  target_paise: number;
  saved_paise: number;
  target_date: string | null;
}

export interface RawInsightInput {
  month: string;
  currency: string;
  /** Days the month has actually seen, for a per-day figure. */
  elapsedDays: number;
  daysInMonth: number;
  current: MonthTotalsRow;
  previous: MonthTotalsRow;
  currentCategories: CategoryTotalRow[];
  previousCategories: CategoryTotalRow[];
  budgets: BudgetRow[];
  goals: GoalRow[];
}

export interface CategoryFigure {
  category: string;
  amount: number;
  share_percent: number;
  transaction_count: number;
  previous_amount: number;
  change_percent: number | null;
}

export interface BudgetFigure {
  category: string;
  limit: number;
  spent: number;
  used_percent: number;
}

export interface GoalFigure {
  /** An opaque label - "goal_1" - never the name the user gave the goal. */
  label: string;
  target: number;
  saved: number;
  progress_percent: number;
  target_date: string | null;
}

export interface InsightPayload {
  month: string;
  currency: string;
  days_elapsed: number;
  days_in_month: number;
  totals: {
    income: number;
    expense: number;
    net: number;
    transaction_count: number;
    daily_average_expense: number;
  };
  previous_month: {
    income: number;
    expense: number;
  };
  categories: CategoryFigure[];
  budgets: BudgetFigure[];
  goals: GoalFigure[];
}

/** How many categories, budgets and goals are worth sending. */
export const MAX_CATEGORIES = 12;
export const MAX_BUDGETS = 12;
export const MAX_GOALS = 6;

export const UNCATEGORISED = 'Uncategorised';

/**
 * Paise to rupees with two decimals.
 *
 * The model reasons about the numbers rather than storing them, and "1234.50"
 * is far less likely to be misread than "123450 paise". Money stays integer
 * paise everywhere else in the app.
 */
export function toRupees(paise: number): number {
  return Math.round(paise) / 100;
}

function percent(part: number, whole: number): number {
  if (whole === 0) {
    return 0;
  }
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Change against last month, or `null` when there is nothing to compare
 * against - a category that is new this month is new, not up by infinity.
 */
function changePercent(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function buildInsightPayload(input: RawInsightInput): InsightPayload {
  const previousByCategory = new Map(
    input.previousCategories.map((row) => [row.category_name ?? UNCATEGORISED, row.spent_paise]),
  );

  const categories = input.currentCategories
    .filter((row) => row.spent_paise > 0)
    .sort((a, b) => b.spent_paise - a.spent_paise)
    .slice(0, MAX_CATEGORIES)
    .map((row) => {
      const name = row.category_name ?? UNCATEGORISED;
      const previous = previousByCategory.get(name) ?? 0;
      return {
        category: name,
        amount: toRupees(row.spent_paise),
        share_percent: percent(row.spent_paise, input.current.expense_paise),
        transaction_count: row.txn_count,
        previous_amount: toRupees(previous),
        change_percent: changePercent(row.spent_paise, previous),
      };
    });

  const budgets = input.budgets
    .filter((row) => row.limit_paise > 0)
    .slice(0, MAX_BUDGETS)
    .map((row) => ({
      category: row.category_name ?? UNCATEGORISED,
      limit: toRupees(row.limit_paise),
      spent: toRupees(row.spent_paise),
      used_percent: percent(row.spent_paise, row.limit_paise),
    }));

  // A goal's name is free text a person typed - "Ravi's wedding", "escape
  // fund". It never leaves the device: the model sees "goal_1" and the
  // function substitutes the real name back into the answer afterwards (see
  // buildLabelMap / hydrateLabels).
  const goals = input.goals.slice(0, MAX_GOALS).map((row, index) => ({
    label: goalLabel(index),
    target: toRupees(row.target_paise),
    saved: toRupees(row.saved_paise),
    progress_percent: percent(row.saved_paise, row.target_paise),
    target_date: row.target_date,
  }));

  const days = Math.max(1, input.elapsedDays);

  return {
    month: input.month,
    currency: input.currency,
    days_elapsed: days,
    days_in_month: input.daysInMonth,
    totals: {
      income: toRupees(input.current.income_paise),
      expense: toRupees(input.current.expense_paise),
      net: toRupees(input.current.income_paise - input.current.expense_paise),
      transaction_count: input.current.expense_count,
      daily_average_expense: toRupees(Math.floor(input.current.expense_paise / days)),
    },
    previous_month: {
      income: toRupees(input.previous.income_paise),
      expense: toRupees(input.previous.expense_paise),
    },
    categories,
    budgets,
    goals,
  };
}

/** "goal_1", "goal_2" - the stand-in the model reasons about. */
export function goalLabel(index: number): string {
  return `goal_${index + 1}`;
}

/** label -> the name the user actually gave the goal, for re-hydration. */
export function buildLabelMap(goals: readonly GoalRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  goals.slice(0, MAX_GOALS).forEach((goal, index) => {
    map[goalLabel(index)] = goal.name;
  });
  return map;
}

/**
 * Puts the real goal names back into the model's text.
 *
 * Runs on the server, after validation and before the row is stored, so the
 * insight a user reads names their goals even though the model never saw
 * them. Longer labels are replaced first so "goal_1" cannot eat the front of
 * "goal_10".
 */
export function hydrateLabels(text: string, labels: Record<string, string>): string {
  const ordered = Object.keys(labels).sort((a, b) => b.length - a.length);
  return ordered.reduce((result, label) => result.split(label).join(labels[label] ?? label), text);
}

/**
 * Every key the payload is allowed to contain, at any depth.
 *
 * The leak test walks the built payload against this list, so adding a field
 * to `InsightPayload` without thinking about it fails the suite rather than
 * quietly widening what leaves the device.
 */
export const ALLOWED_PAYLOAD_KEYS = [
  'month',
  'currency',
  'days_elapsed',
  'days_in_month',
  'totals',
  'income',
  'expense',
  'net',
  'transaction_count',
  'daily_average_expense',
  'previous_month',
  'categories',
  'category',
  'amount',
  'share_percent',
  'previous_amount',
  'change_percent',
  'budgets',
  'limit',
  'spent',
  'used_percent',
  'goals',
  'label',
  'target',
  'saved',
  'progress_percent',
  'target_date',
] as const;
