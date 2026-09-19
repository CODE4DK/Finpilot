/**
 * Logging, with the user's money left out of it.
 *
 * A finance app's logs are a liability. Anything written here can end up in
 * `adb logcat`, in a crash reporter, or in a screenshot of a developer's
 * console - and a log line is exactly where an amount, a note or a token
 * leaks, because nobody puts one there on purpose. They arrive inside an
 * error message: PostgREST quotes the offending values back, Supabase echoes
 * the request, and a `JSON.stringify(row)` in a catch block does the rest.
 *
 * So everything goes through `redact` first. The rule is deliberately blunt -
 * it is better to redact a harmless number than to miss a real balance.
 */

export type LogLevel = 'warn' | 'error';

/** Longest line worth writing; anything more is a dumped object. */
const MAX_LENGTH = 500;

interface Redaction {
  pattern: RegExp;
  replacement: string;
}

const REDACTIONS: Redaction[] = [
  // Bearer tokens and JWTs, which are the only true secrets a client holds.
  { pattern: /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: '[jwt]' },
  {
    // The value may itself start with "Bearer", and in a JSON dump both the
    // key and the value are quoted - hence the optional quotes either side.
    pattern:
      /\b(bearer|authorization|apikey|api_key|token|password|pin)\b["']?\s*[:=]\s*["']?(?:bearer\s+)?[^\s,}"']+/gi,
    replacement: '$1=[redacted]',
  },
  // Email addresses: the user's identity, and never needed to debug.
  { pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replacement: '[email]' },
  // Indian mobile numbers, with or without the country code.
  { pattern: /\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g, replacement: '[phone]' },
  // Anything named like money, however it is written.
  {
    pattern:
      // Postgres writes these as `(amount_paise)=(500000)`, JSON as
      // `"amount_paise":500000` - the separator class covers both.
      /\b(amount_paise|amount|balance|limit_paise|target_paise|saved_paise|spent_paise|opening_balance_paise)\b["')\s:=(]*-?\d+/gi,
    replacement: '$1=[amount]',
  },
  // A bare rupee figure - "₹12,500", "Rs 12500".
  { pattern: /(?:₹|\bRs\.?\s*)\s?-?[\d,]+(?:\.\d+)?/gi, replacement: '[amount]' },
  // A run of digits long enough to be an amount in paise or a card number.
  { pattern: /\b\d{7,}\b/g, replacement: '[digits]' },
];

/**
 * Scrubs a line. Not a security boundary on its own - the real rule is "do
 * not log the row" - but it is the net under that rule.
 */
export function redact(input: unknown): string {
  let text: string;

  if (input instanceof Error) {
    text = `${input.name}: ${input.message}`;
  } else if (typeof input === 'string') {
    text = input;
  } else {
    try {
      text = JSON.stringify(input) ?? String(input);
    } catch {
      text = '[unserialisable]';
    }
  }

  for (const { pattern, replacement } of REDACTIONS) {
    text = text.replace(pattern, replacement);
  }

  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}…[truncated]` : text;
}

type Sink = (message: string) => void;

const SINKS: Record<LogLevel, Sink> = {
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
};

/**
 * `scope` is the subsystem - "powersync", "auth". There is no `info` or
 * `debug` level on purpose: a level nobody reads in production is a level
 * that accumulates whatever is convenient, and what is convenient is the row.
 */
export function log(level: LogLevel, scope: string, message: string, detail?: unknown): void {
  const parts = [`[${scope}] ${redact(message)}`];
  if (detail !== undefined) {
    parts.push(redact(detail));
  }
  SINKS[level](parts.join(' - '));
}

export function logWarn(scope: string, message: string, detail?: unknown): void {
  log('warn', scope, message, detail);
}

export function logError(scope: string, message: string, detail?: unknown): void {
  log('error', scope, message, detail);
}
