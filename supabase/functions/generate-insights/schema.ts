/**
 * The contract with the model.
 *
 * The model is asked for JSON in exactly this shape, and the same schema then
 * validates what comes back. Structured outputs make a malformed response
 * unlikely; validating anyway is what makes it *impossible* for a bad
 * response to reach the insights table, where the app would render it.
 *
 * Bounds are deliberate. A `summary` with no ceiling is a card that pushes
 * everything else off the Home screen, and an unbounded array is an
 * unbounded render loop.
 */

import { z } from 'zod';

/** Short enough to read on a phone, long enough to say something. */
const sentence = z.string().trim().min(1).max(280);

export const HighlightSchema = z.object({
  title: z.string().trim().min(1).max(80),
  detail: sentence,
});

export const UnusualSpendSchema = z.object({
  category: z.string().trim().min(1).max(60),
  detail: sentence,
  /** How far out of line this is, so the app can sort and tone it. */
  severity: z.enum(['low', 'medium', 'high']),
});

export const SuggestionSchema = z.object({
  title: z.string().trim().min(1).max(80),
  detail: sentence,
});

export const InsightResponseSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  highlights: z.array(HighlightSchema).max(5),
  unusual_spend: z.array(UnusualSpendSchema).max(5),
  suggestions: z.array(SuggestionSchema).max(5),
});

export type InsightResponse = z.infer<typeof InsightResponseSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type UnusualSpend = z.infer<typeof UnusualSpendSchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;

/**
 * The JSON Schema handed to the API as the output format.
 *
 * Written out rather than derived from the zod schema so that what the model
 * is told and what the validator enforces can both be read here, side by
 * side, and so this module has no dependency on a zod-to-JSON-Schema helper
 * inside the Deno runtime.
 */
export const INSIGHT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    highlights: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, detail: { type: 'string' } },
        required: ['title', 'detail'],
        additionalProperties: false,
      },
    },
    unusual_spend: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['category', 'detail', 'severity'],
        additionalProperties: false,
      },
    },
    suggestions: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, detail: { type: 'string' } },
        required: ['title', 'detail'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'highlights', 'unusual_spend', 'suggestions'],
  additionalProperties: false,
} as const;

export interface ValidationSuccess {
  ok: true;
  value: InsightResponse;
}

export interface ValidationFailure {
  ok: false;
  /** Short, loggable, and free of the model's actual output. */
  reason: string;
}

/**
 * Parses and validates a model response.
 *
 * Never throws: a bad response from the model is an expected outcome, not an
 * exception, and the caller records it as `invalid_response` and tells the
 * app to fall back to the on-device rules.
 */
export function validateInsightResponse(raw: unknown): ValidationSuccess | ValidationFailure {
  let candidate = raw;

  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'response was not valid JSON' };
    }
  }

  const parsed = InsightResponseSchema.safeParse(candidate);
  if (!parsed.success) {
    // Issue paths only - the values are the model's text, and this string is
    // written to a log table.
    const paths = parsed.error.issues
      .map((issue) => issue.path.join('.') || '(root)')
      .slice(0, 5)
      .join(', ');
    return { ok: false, reason: `response failed validation at: ${paths}` };
  }

  return { ok: true, value: parsed.data };
}

/** Applies a transform to every string the model produced. */
export function mapInsightStrings(
  value: InsightResponse,
  transform: (text: string) => string,
): InsightResponse {
  return {
    summary: transform(value.summary),
    highlights: value.highlights.map((item) => ({
      title: transform(item.title),
      detail: transform(item.detail),
    })),
    unusual_spend: value.unusual_spend.map((item) => ({
      category: transform(item.category),
      detail: transform(item.detail),
      severity: item.severity,
    })),
    suggestions: value.suggestions.map((item) => ({
      title: transform(item.title),
      detail: transform(item.detail),
    })),
  };
}
