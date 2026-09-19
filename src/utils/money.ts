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
 * The largest amount that survives the round trip to paise: `MAX_SAFE_INTEGER`
 * paise is about 90 thousand crore rupees. Past it, integer arithmetic stops
 * being exact and `assertPaise` refuses the value.
 */
export const MAX_AMOUNT_RUPEES = Math.floor(Number.MAX_SAFE_INTEGER / PAISE_PER_RUPEE);

/**
 * Parse free-form user input ("1,234.50", "₹1234", "-90") into paise.
 * Returns null when the input is not a valid amount, so callers can show a
 * validation message instead of handling an exception.
 *
 * "Not valid" includes "too large to be exact": a user holding a key down can
 * reach 1e20, and turning that into paise is a `MoneyError` thrown from inside
 * a keystroke handler. A rejected amount is a validation message; a thrown one
 * is a crash.
 */
export function parseAmountToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (cleaned === '' || cleaned === '-' || !/^-?\d*\.?\d*$/.test(cleaned)) {
    return null;
  }
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > MAX_AMOUNT_RUPEES) {
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

/**
 * Format paise for display. Delegates to `formatINR` so every surface gets
 * Indian digit grouping, including on Hermes builds that ship a minimal ICU
 * and would otherwise group `Intl` output the Western way.
 */
export function formatPaise(paise: number, options: FormatPaiseOptions = {}): string {
  return formatINR(paise, options);
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

/**
 * Group an integer string the Indian way: the last three digits, then pairs.
 * 100000 -> "1,00,000". Used as a fallback when the JS engine on the device
 * ships a minimal ICU and `Intl` groups the Western way.
 */
export function groupIndianDigits(digits: string): string {
  if (digits.length <= 3) {
    return digits;
  }
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`;
}

export interface FormatInrOptions extends FormatPaiseOptions {
  /** Render 1,25,000 as "1.25L" / 1,20,00,000 as "1.2Cr". */
  compact?: boolean;
}

/**
 * The display entry point for money: always integer paise in, a ₹ string out,
 * grouped the Indian way (1,00,000 - not 100,000) regardless of the engine's
 * ICU build.
 */
export function formatINR(paise: number, options: FormatInrOptions = {}): string {
  const { withSymbol = true, withDecimals = true, signDisplay = 'auto', compact = false } = options;
  assertPaise(paise);

  if (compact) {
    return formatCompactINR(paise, { withSymbol, signDisplay });
  }

  const negative = paise < 0;
  const absolute = Math.abs(paise);
  const rupees = Math.trunc(absolute / PAISE_PER_RUPEE);
  const remainder = absolute % PAISE_PER_RUPEE;

  const grouped = groupIndianDigits(String(rupees));
  const decimals = withDecimals ? `.${String(remainder).padStart(2, '0')}` : '';
  const sign = negative ? '-' : signDisplay === 'always' ? '+' : '';
  const symbol = withSymbol ? '₹' : '';

  return `${sign}${symbol}${grouped}${decimals}`;
}

const COMPACT_UNITS = [
  { threshold: 1_00_00_000_00, suffix: 'Cr', divisor: 1_00_00_000_00 },
  { threshold: 1_00_000_00, suffix: 'L', divisor: 1_00_000_00 },
  { threshold: 1_000_00, suffix: 'K', divisor: 1_000_00 },
] as const;

/** "₹1.25L", "₹2.4Cr" - for chart axes and dense summary tiles. */
export function formatCompactINR(
  paise: number,
  options: Pick<FormatPaiseOptions, 'withSymbol' | 'signDisplay'> = {},
): string {
  const { withSymbol = true, signDisplay = 'auto' } = options;
  assertPaise(paise);

  const negative = paise < 0;
  const absolute = Math.abs(paise);
  const sign = negative ? '-' : signDisplay === 'always' ? '+' : '';
  const symbol = withSymbol ? '₹' : '';

  const unit = COMPACT_UNITS.find((candidate) => absolute >= candidate.threshold);
  if (!unit) {
    return formatINR(paise, { withSymbol, withDecimals: false, signDisplay });
  }

  const value = absolute / unit.divisor;
  // One decimal, but drop a trailing ".0" so we get "2Cr" rather than "2.0Cr".
  const rendered = value
    .toFixed(value < 10 ? 2 : 1)
    .replace(/0+$/, '')
    .replace(/\.$/, '');
  return `${sign}${symbol}${rendered}${unit.suffix}`;
}

/* ------------------------------------------------------------------ *
 * Safe arithmetic. Every helper asserts its inputs are integer paise
 * and its result stays a safe integer, so a float can never creep into
 * a balance through a stray division.
 * ------------------------------------------------------------------ */

export function addPaise(a: number, b: number): number {
  return assertPaise(assertPaise(a) + assertPaise(b));
}

export function subtractPaise(a: number, b: number): number {
  return assertPaise(assertPaise(a) - assertPaise(b));
}

/** Multiply by a whole count (3 instalments), never by a fractional rate. */
export function multiplyPaise(paise: number, factor: number): number {
  assertPaise(paise);
  if (!Number.isSafeInteger(factor)) {
    throw new MoneyError(`Expected an integer factor, received: ${factor}`);
  }
  return assertPaise(paise * factor);
}

/**
 * Apply a rate (interest, a share, a tax) and round to the nearest paisa,
 * half away from zero.
 */
export function scalePaise(paise: number, rate: number): number {
  assertPaise(paise);
  if (!Number.isFinite(rate)) {
    throw new MoneyError(`Expected a finite rate, received: ${rate}`);
  }
  const scaled = paise * rate;
  return assertPaise(Math.sign(scaled) * Math.round(Math.abs(scaled)));
}

export function negatePaise(paise: number): number {
  // `-0` is a real value in JS and would leak into state and snapshots, so
  // normalise it back to 0.
  const negated = -assertPaise(paise);
  return assertPaise(negated === 0 ? 0 : negated);
}

export function absPaise(paise: number): number {
  return assertPaise(Math.abs(assertPaise(paise)));
}

export function comparePaise(a: number, b: number): -1 | 0 | 1 {
  const difference = subtractPaise(a, b);
  return difference === 0 ? 0 : difference < 0 ? -1 : 1;
}

export function clampPaise(paise: number, min: number, max: number): number {
  assertPaise(paise);
  assertPaise(min);
  assertPaise(max);
  if (min > max) {
    throw new MoneyError(`Expected min <= max, received min ${min} and max ${max}`);
  }
  return Math.min(Math.max(paise, min), max);
}

export function isZero(paise: number): boolean {
  return assertPaise(paise) === 0;
}

export function isNegative(paise: number): boolean {
  return assertPaise(paise) < 0;
}
