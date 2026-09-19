/**
 * generate-insights
 *
 * The only part of FinPilot that sends anything anywhere except the user's own
 * Supabase project. It runs here, not on the device, for one reason: the
 * Anthropic API key. Anything privileged belongs in an Edge Function, and a
 * key shipped in an app bundle is a key that has been published.
 *
 * The order of the checks below is the whole security design:
 *
 *   1. verify the caller's JWT - who is this?
 *   2. check profiles.ai_insights_opt_in - did they agree to this?
 *   3. rate limit per user per day - has this already run enough today?
 *   4. build an aggregated payload - what may leave the device?
 *   5. call the model, validate the answer, store it.
 *
 * Steps 1-3 happen before a single byte of the user's data is read, so a
 * caller who fails any of them costs nothing and reveals nothing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import {
  buildInsightPayload,
  buildLabelMap,
  hydrateLabels,
  type BudgetRow,
  type CategoryTotalRow,
  type GoalRow,
  type MonthTotalsRow,
} from './payload.ts';
import { buildUserPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from './prompt.ts';
import { INSIGHT_JSON_SCHEMA, mapInsightStrings, validateInsightResponse } from './schema.ts';

const MODEL = 'claude-opus-5';

/**
 * Generations per user per day. Enough to regenerate after adding a few
 * transactions, low enough that a stolen token cannot run up a bill.
 */
const DAILY_LIMIT = 5;

type RequestStatus =
  'succeeded' | 'model_error' | 'invalid_response' | 'rate_limited' | 'not_opted_in';

interface GenerateRequest {
  /** "2026-09-01". Defaults to the current month in the user's timezone. */
  month?: string;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = requireEnv('ANTHROPIC_API_KEY');

  // 1. Who is this? The anon client validates the caller's own JWT; nothing
  //    downstream trusts a user id from the request body.
  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: auth, error: authError } = await asUser.auth.getUser();
  if (authError || !auth?.user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const userId = auth.user.id;

  // The service client bypasses RLS, so every query below is scoped to
  // `userId` by hand. That is deliberate: the aggregation joins and the
  // request log are not reachable with the caller's own token.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const body = (await readJson(request)) as GenerateRequest;

  const { data: profile } = await admin
    .from('profiles')
    .select('ai_insights_opt_in, currency, timezone')
    .eq('id', userId)
    .maybeSingle();

  const month = normaliseMonth(body?.month, profile?.timezone ?? 'Asia/Kolkata');

  // 2. Did they agree to this? The opt-in is checked server-side as well as
  //    in the app, because the app is not a security boundary.
  if (!profile?.ai_insights_opt_in) {
    await logRequest(admin, userId, month, 'not_opted_in');
    return jsonResponse({ error: 'not_opted_in' }, 403);
  }

  // 3. Has this already run enough today?
  const used = await countToday(admin, userId);
  if (used >= DAILY_LIMIT) {
    await logRequest(admin, userId, month, 'rate_limited');
    return jsonResponse(
      { error: 'rate_limited', limit: DAILY_LIMIT, used, retry_after_hours: hoursUntilMidnight() },
      429,
    );
  }

  // 4. What may leave the device? Only what buildInsightPayload returns.
  const raw = await readAggregates(admin, userId, month, profile.currency ?? 'INR');
  if (raw.current.expense_count === 0 && raw.current.income_paise === 0) {
    return jsonResponse({ error: 'not_enough_data', month }, 422);
  }

  const payload = buildInsightPayload(raw);
  const labels = buildLabelMap(raw.goals);

  // 5. Ask, validate, store.
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(payload) }],
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: INSIGHT_JSON_SCHEMA },
      },
    });
  } catch (error) {
    await logRequest(admin, userId, month, 'model_error', { detail: describeError(error) });
    return jsonResponse({ error: 'model_unavailable' }, 502);
  }

  if (response.stop_reason === 'refusal') {
    await logRequest(admin, userId, month, 'model_error', {
      model: response.model,
      detail: `refusal: ${response.stop_details?.category ?? 'unknown'}`,
    });
    return jsonResponse({ error: 'model_unavailable' }, 502);
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const validated = validateInsightResponse(text);
  if (!validated.ok) {
    await logRequest(admin, userId, month, 'invalid_response', {
      model: response.model,
      detail: validated.reason,
      usage: response.usage,
    });
    return jsonResponse({ error: 'invalid_response' }, 502);
  }

  // The model never saw the user's goal names; put them back now.
  const insight = mapInsightStrings(validated.value, (value) => hydrateLabels(value, labels));

  const generatedAt = new Date().toISOString();
  const summary = {
    ...insight,
    source: 'ai' as const,
    model: response.model,
    prompt_version: PROMPT_VERSION,
    generated_at: generatedAt,
  };

  // One insight per user per month: a regeneration replaces the old one
  // rather than piling up rows the app would have to disambiguate.
  const { error: upsertError } = await admin
    .from('insights')
    .upsert(
      {
        user_id: userId,
        month,
        summary,
        generated_at: generatedAt,
        updated_at: generatedAt,
        deleted_at: null,
      },
      { onConflict: 'user_id,month' },
    )
    .select('id')
    .maybeSingle();

  if (upsertError) {
    await logRequest(admin, userId, month, 'model_error', {
      detail: 'could not store the insight',
    });
    return jsonResponse({ error: 'storage_failed' }, 500);
  }

  await logRequest(admin, userId, month, 'succeeded', {
    model: response.model,
    usage: response.usage,
  });

  return jsonResponse({ month, insight: summary, remaining: DAILY_LIMIT - used - 1 });
});

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not set on the function`);
  }
  return value;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    // A body is optional - the month defaults to this one.
    return {};
  }
}

/** "2026-09-01" for the first of the month, validated rather than trusted. */
function normaliseMonth(requested: string | undefined, timezone: string): string {
  if (requested && /^\d{4}-\d{2}-01$/.test(requested)) {
    return requested;
  }
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value ?? `${now.getUTCFullYear()}`;
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  return `${year}-${month}-01`;
}

function hoursUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 3_600_000);
}

/** The model's error text can carry request content; only the shape is logged. */
function describeError(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    return `api error ${error.status}`;
  }
  return 'request failed';
}

async function countToday(admin: SupabaseClient, userId: string): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { count } = await admin
    .from('ai_insight_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('requested_at', since.toISOString())
    // A request that was refused before it cost anything does not count
    // against the user.
    .in('status', ['succeeded', 'model_error', 'invalid_response']);

  return count ?? 0;
}

async function logRequest(
  admin: SupabaseClient,
  userId: string,
  month: string,
  status: RequestStatus,
  extra: {
    model?: string;
    detail?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  } = {},
): Promise<void> {
  await admin.from('ai_insight_requests').insert({
    user_id: userId,
    month,
    status,
    model: extra.model ?? null,
    detail: extra.detail?.slice(0, 500) ?? null,
    input_tokens: extra.usage?.input_tokens ?? null,
    output_tokens: extra.usage?.output_tokens ?? null,
  });
}

interface Aggregates {
  month: string;
  currency: string;
  elapsedDays: number;
  daysInMonth: number;
  current: MonthTotalsRow;
  previous: MonthTotalsRow;
  currentCategories: CategoryTotalRow[];
  previousCategories: CategoryTotalRow[];
  budgets: BudgetRow[];
  goals: GoalRow[];
}

/**
 * Reads the aggregates through a SECURITY DEFINER function rather than a
 * dozen round trips: one statement, one plan, and the whole shape of what is
 * read lives in the migration next to the table definitions.
 */
async function readAggregates(
  admin: SupabaseClient,
  userId: string,
  month: string,
  currency: string,
): Promise<Aggregates> {
  const { data, error } = await admin.rpc('ai_insight_aggregates', {
    p_user_id: userId,
    p_month: month,
  });

  if (error || !data) {
    throw new Error('could not read the aggregates');
  }

  const result = data as Omit<Aggregates, 'month' | 'currency'>;
  return { ...result, month, currency };
}
