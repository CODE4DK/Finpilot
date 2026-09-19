/**
 * SQLite has no boolean, no timestamp and no JSON type, so rows arriving from
 * PowerSync use INTEGER 0/1 and TEXT. These helpers are the single boundary
 * where that representation is translated - nothing above the repository layer
 * should know about it.
 */

export function toBoolean(value: number | boolean | null | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return value === 1;
}

export function fromBoolean(value: boolean): number {
  return value ? 1 : 0;
}

export function toOptionalDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDate(value: string | null | undefined, fallback: Date = new Date()): Date {
  return toOptionalDate(value) ?? fallback;
}

/** Parses a jsonb column, which arrives as TEXT. Never throws. */
export function toJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function fromJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

/**
 * Money columns are INTEGER paise. A row that somehow carries a float or a
 * null is coerced rather than allowed to poison a balance calculation.
 */
export function toPaise(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value);
}

/** ISO-8601 UTC, the format every timestamp column round-trips through. */
export function nowIso(date: Date = new Date()): string {
  return date.toISOString();
}
