/**
 * What the model says is not trusted until it parses.
 *
 * Structured outputs make a malformed response unlikely; this is what makes a
 * malformed response *harmless*. Anything that fails here is recorded as
 * `invalid_response` and the app falls back to its own rules - nothing
 * half-valid ever reaches the insights table.
 */

import {
  INSIGHT_JSON_SCHEMA,
  mapInsightStrings,
  validateInsightResponse,
  type InsightResponse,
} from '../../../../supabase/functions/generate-insights/schema';

const VALID: InsightResponse = {
  summary: 'You have spent ₹7,300 so far this month, ₹1,200 more than by this point last month.',
  highlights: [{ title: 'Rent is your largest category', detail: '₹5,000, 68% of your spending.' }],
  unusual_spend: [{ category: 'Food', detail: 'Up 82% on last month.', severity: 'medium' }],
  suggestions: [{ title: 'Set a food budget', detail: 'A limit makes it visible as it happens.' }],
};

describe('validateInsightResponse', () => {
  it('accepts a well-formed response', () => {
    const result = validateInsightResponse(VALID);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.summary).toContain('₹7,300');
  });

  it('parses a JSON string, which is what the API actually returns', () => {
    const result = validateInsightResponse(JSON.stringify(VALID));

    expect(result.ok).toBe(true);
  });

  it('rejects text that is not JSON at all', () => {
    const result = validateInsightResponse('Here are your insights! 1. You spent a lot.');

    expect(result).toEqual({ ok: false, reason: 'response was not valid JSON' });
  });

  it('rejects a response missing a required section', () => {
    const { suggestions: _dropped, ...partial } = VALID;
    const result = validateInsightResponse(partial);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('suggestions');
  });

  it('rejects an unknown severity rather than rendering it', () => {
    const result = validateInsightResponse({
      ...VALID,
      unusual_spend: [{ category: 'Food', detail: 'Up a lot.', severity: 'catastrophic' }],
    });

    expect(result.ok).toBe(false);
  });

  it('rejects an empty summary', () => {
    expect(validateInsightResponse({ ...VALID, summary: '   ' }).ok).toBe(false);
  });

  it('rejects a summary long enough to bury the screen', () => {
    expect(validateInsightResponse({ ...VALID, summary: 'a'.repeat(601) }).ok).toBe(false);
  });

  it('rejects more items than the screen will render', () => {
    const result = validateInsightResponse({
      ...VALID,
      highlights: Array.from({ length: 6 }, () => VALID.highlights[0]!),
    });

    expect(result.ok).toBe(false);
  });

  it('never puts the model output into the failure reason', () => {
    // The reason is written to a server-side log table; the model's text may
    // carry the user's figures.
    const result = validateInsightResponse({
      ...VALID,
      summary: 'SENSITIVE ₹1,23,456',
      highlights: 'not an array',
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).not.toContain('SENSITIVE');
    expect(!result.ok && result.reason).toBe('response failed validation at: highlights');
  });

  it('accepts empty arrays - "nothing stood out" is a valid answer', () => {
    const result = validateInsightResponse({
      summary: 'A quiet month.',
      highlights: [],
      unusual_spend: [],
      suggestions: [],
    });

    expect(result.ok).toBe(true);
  });

  it('trims whitespace the model added', () => {
    const result = validateInsightResponse({ ...VALID, summary: '  Spaced out.  ' });

    expect(result.ok && result.value.summary).toBe('Spaced out.');
  });

  it('rejects null and arrays at the root', () => {
    expect(validateInsightResponse(null).ok).toBe(false);
    expect(validateInsightResponse([VALID]).ok).toBe(false);
  });
});

describe('the schema the model is given', () => {
  it('matches the sections the validator requires', () => {
    expect(INSIGHT_JSON_SCHEMA.required).toEqual([
      'summary',
      'highlights',
      'unusual_spend',
      'suggestions',
    ]);
    expect(INSIGHT_JSON_SCHEMA.additionalProperties).toBe(false);
  });
});

describe('mapInsightStrings', () => {
  it('reaches every string the model produced', () => {
    const shouted = mapInsightStrings(VALID, (text) => text.toUpperCase());

    expect(shouted.summary).toBe(VALID.summary.toUpperCase());
    expect(shouted.highlights[0]!.detail).toBe(VALID.highlights[0]!.detail.toUpperCase());
    expect(shouted.unusual_spend[0]!.category).toBe('FOOD');
    expect(shouted.suggestions[0]!.title).toBe(VALID.suggestions[0]!.title.toUpperCase());
  });

  it('leaves the severity enum alone', () => {
    expect(mapInsightStrings(VALID, () => 'x').unusual_spend[0]!.severity).toBe('medium');
  });
});
