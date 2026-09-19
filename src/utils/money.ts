/**
 * Money in FinPilot is always an integer number of paise (1 rupee = 100 paise).
 * Floats are never used for storage or computation - only at display time do we
 * turn paise into a human-readable string.
 */

export const PAISE_PER_RUPEE = 100;

export class MoneyError extends Error {}

/** Narrowing helper: a finite, safe integer count of paise. */
export function isPaise(value: number): boolean {
  return Number.isSafeInteger(value);
}

export function assertPaise(value: number): number {
  if (!isPaise(value)) {
    throw new MoneyError(`Expected an integer amount in paise, received: ${value}`);
  }
  return value;
}

/**
 * Convert a rupee amount (as typed by a user) into integer paise.
 * Rounds half away from zero so that 0.005 -> 1 paisa and -0.005 -> -1 paisa.
 */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new MoneyError(`Expected a finite rupee amount, received: ${rupees}`);
  }
  const scaled = rupees * PAISE_PER_RUPEE;
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
  return assertPaise(rounded === 0 ? 0 : rounded);
}

/** Lossy on purpose - only for display or charting, never for storage. */
export function paiseToRupees(paise: number): number {
  return assertPaise(paise) / PAISE_PER_RUPEE;
}

/**
 * Parse free-form user input ("1,234.50", "₹1234", "-90") into paise.
 * Returns null when the input is not a valid amount, so callers can show a
 * validation message instead of handling an exception.
 */
export function parseAmountToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (cleaned === '' || cleaned === '-' || !/^-?\d*\.?\d*$/.test(cleaned)) {
    return null;
  }
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return rupeesToPaise(parsed);
}

export interface FormatPaiseOptions {
  /** Show the ₹ symbol. Defaults to true. */
  withSymbol?: boolean;
  /** Always show paise. Defaults to true; set false for rounded summaries. */
  withDecimals?: boolean;
  /** Prefix positive amounts with "+". Useful for income rows. */
  signDisplay?: 'auto' | 'always';
}

/** Format paise for display using the Indian numbering system. */
export function formatPaise(paise: number, options: FormatPaiseOptions = {}): string {
  const { withSymbol = true, withDecimals = true, signDisplay = 'auto' } = options;
  assertPaise(paise);

  const formatter = new Intl.NumberFormat('en-IN', {
    style: withSymbol ? 'currency' : 'decimal',
    currency: 'INR',
    currencyDisplay: 'symbol',
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
    signDisplay,
  });

  return formatter.format(paiseToRupees(paise));
}

/** Sum a list of paise amounts, guarding against float contamination. */
export function sumPaise(amounts: readonly number[]): number {
  return amounts.reduce<number>((total, amount) => total + assertPaise(amount), 0);
}

/**
 * Split an amount into `parts` shares whose total is exactly the input.
 * Remainder paise are handed out one at a time to the earliest shares, so
 * splitting 1000 paise three ways gives [334, 333, 333].
 */
export function splitPaise(paise: number, parts: number): number[] {
  assertPaise(paise);
  if (!Number.isSafeInteger(parts) || parts <= 0) {
    throw new MoneyError(`Expected a positive integer number of parts, received: ${parts}`);
  }
  const sign = paise < 0 ? -1 : 1;
  const absolute = Math.abs(paise);
  const base = Math.floor(absolute / parts);
  const remainder = absolute - base * parts;
  return Array.from({ length: parts }, (_, index) => sign * (base + (index < remainder ? 1 : 0)));
}

/** Percentage of `part` within `whole`, rounded to `decimals` places. */
export function percentageOfPaise(part: number, whole: number, decimals = 1): number {
  assertPaise(part);
  assertPaise(whole);
  if (whole === 0) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round((part / whole) * 100 * factor) / factor;
}
