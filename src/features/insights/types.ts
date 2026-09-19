/**
 * The shape of an insight, on the device.
 *
 * Two things produce one: the Edge Function (`source: 'ai'`) and the on-device
 * rules (`source: 'rules'`). They share a shape so the screen renders either
 * without caring which it got - the only difference the user sees is the badge
 * saying where it came from.
 *
 * The `insights.summary` column is jsonb, which arrives from SQLite as TEXT,
 * so anything read out of the local database goes through `parseInsight`.
 */

export type InsightSource = 'ai' | 'rules';

export type Severity = 'low' | 'medium' | 'high';

export interface InsightHighlight {
  title: string;
  detail: string;
}

export interface InsightUnusualSpend {
  category: string;
  detail: string;
  severity: Severity;
}

export interface InsightSuggestion {
  title: string;
  detail: string;
}

export interface Insight {
  summary: string;
  highlights: InsightHighlight[];
  unusual_spend: InsightUnusualSpend[];
  suggestions: InsightSuggestion[];
  source: InsightSource;
  /** Present on an AI insight; absent on the rule-based fallback. */
  model?: string;
  generated_at: string;
}

const SEVERITIES: Severity[] = ['low', 'medium', 'high'];

function asString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, max);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Parses a stored insight defensively.
 *
 * The server validates before it writes, so a malformed row should not exist -
 * but this row syncs, and the version of the app reading it may be older than
 * the version that wrote it. A card that renders nothing is better than one
 * that crashes the Home screen.
 */
export function parseInsight(raw: string | null | undefined): Insight | null {
  if (!raw) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const summary = asString(record.summary, 600);
  if (!summary) {
    return null;
  }

  return {
    summary,
    highlights: asArray(record.highlights).flatMap((item) => {
      const entry = item as Record<string, unknown>;
      const title = asString(entry?.title, 80);
      const detail = asString(entry?.detail, 280);
      return title && detail ? [{ title, detail }] : [];
    }),
    unusual_spend: asArray(record.unusual_spend).flatMap((item) => {
      const entry = item as Record<string, unknown>;
      const category = asString(entry?.category, 60);
      const detail = asString(entry?.detail, 280);
      const severity = SEVERITIES.includes(entry?.severity as Severity)
        ? (entry.severity as Severity)
        : 'low';
      return category && detail ? [{ category, detail, severity }] : [];
    }),
    suggestions: asArray(record.suggestions).flatMap((item) => {
      const entry = item as Record<string, unknown>;
      const title = asString(entry?.title, 80);
      const detail = asString(entry?.detail, 280);
      return title && detail ? [{ title, detail }] : [];
    }),
    source: record.source === 'ai' ? 'ai' : 'rules',
    model: asString(record.model, 80) ?? undefined,
    generated_at: asString(record.generated_at, 40) ?? new Date(0).toISOString(),
  };
}
