/**
 * delete-account
 *
 * Both app stores require an in-app way to delete the account and everything
 * in it. This is that, and it runs here because deleting the auth user needs
 * the service role - which is never in the app bundle.
 *
 * It is the one place in FinPilot that performs a **hard** delete. Everywhere
 * else a delete is a `deleted_at` stamp, because a soft delete has to
 * replicate to the user's other devices. There is nothing to replicate to
 * here: the account is going away.
 *
 * Order matters. Children first, then parents, then the profile, then the auth
 * user - the composite foreign keys would otherwise refuse, and a half-deleted
 * account is worse than none of it deleted. Deleting the auth user last also
 * means a failure part-way leaves the user able to sign in and try again.
 */

import { createClient } from '@supabase/supabase-js';

import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';

/** Children before parents. `profiles` is deleted separately, keyed by id. */
const TABLES_IN_ORDER = [
  'goal_contributions',
  'transactions',
  'recurring_rules',
  'budgets',
  'goals',
  'insights',
  'categories',
  'accounts',
  'ai_insight_requests',
] as const;

/** The user has to mean it; the app makes them type this. */
const CONFIRMATION_WORD = 'DELETE';

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

  // The caller's own token decides whose account is deleted. A user id in the
  // body would let anyone delete anyone.
  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: auth, error: authError } = await asUser.auth.getUser();
  if (authError || !auth?.user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const userId = auth.user.id;

  const body = await readJson(request);
  if (body.confirm !== CONFIRMATION_WORD) {
    return jsonResponse({ error: 'not_confirmed' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const deleted: Record<string, number> = {};

  for (const table of TABLES_IN_ORDER) {
    const { error, count } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .eq('user_id', userId);

    if (error) {
      // Stop at the first failure rather than carrying on and leaving the
      // account in a shape nothing can reason about.
      return jsonResponse({ error: 'delete_failed', table, deleted }, 500);
    }
    deleted[table] = count ?? 0;
  }

  const { error: profileError, count: profileCount } = await admin
    .from('profiles')
    .delete({ count: 'exact' })
    .eq('id', userId);

  if (profileError) {
    return jsonResponse({ error: 'delete_failed', table: 'profiles', deleted }, 500);
  }
  deleted.profiles = profileCount ?? 0;

  // Last: without this the rows are gone but the user can still sign in, and
  // the auth trigger would hand them a fresh profile and a new set of default
  // categories - an account they thought they had deleted.
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    return jsonResponse({ error: 'auth_delete_failed', deleted }, 500);
  }

  return jsonResponse({ deleted, user_deleted: true });
});

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
    return {};
  }
}
