/**
 * The prompt.
 *
 * Kept separate from the handler so it can be read, diffed and tested on its
 * own - a prompt is behaviour, and it changes more often than the plumbing
 * around it.
 */

import type { InsightPayload } from './payload.ts';

export const SYSTEM_PROMPT = [
  'You are a careful personal finance assistant for a user in India.',
  'You will be given aggregated figures for one month. Every amount is in Indian rupees.',
  '',
  'Rules:',
  '- Use only the figures given. Never invent a number, a merchant, or a transaction.',
  '- If the data is too thin to say something useful, say so plainly and return fewer items.',
  '- Refer to a goal only by the label given (for example goal_1). Do not invent a name for it.',
  '- Be specific and quantitative: name the category and the amount or percentage.',
  '- Be neutral and practical. No moralising about how someone spends their money,',
  '  no guilt, and no financial product recommendations.',
  '- Write for a phone screen: short sentences, no markdown, no emoji.',
  '- Format money the Indian way with the rupee symbol, for example ₹12,500.',
].join('\n');

/**
 * The user turn: an instruction and the payload as JSON.
 *
 * The payload is pretty-printed because the numbers are the whole input and a
 * readable structure measurably helps the model keep categories and months
 * straight.
 */
export function buildUserPrompt(payload: InsightPayload): string {
  return [
    `Here are the aggregated figures for ${payload.month}.`,
    '',
    JSON.stringify(payload, null, 2),
    '',
    'Produce:',
    '- summary: two or three sentences on how the month is going.',
    '- highlights: up to 3 things that are true and worth knowing.',
    '- unusual_spend: up to 3 categories that are out of line with last month,',
    '  with severity reflecting how far out of line. Return an empty array if',
    '  nothing stands out - do not manufacture an anomaly.',
    '- suggestions: up to 3 concrete, small actions based on these figures.',
  ].join('\n');
}

/** The prompt is stable across requests, which is what makes it cacheable. */
export const PROMPT_VERSION = '2026-09-19';
