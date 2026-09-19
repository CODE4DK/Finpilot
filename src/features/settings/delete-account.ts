/**
 * Account deletion.
 *
 * Both app stores require an in-app route to delete the account and its data,
 * not an email address to write to. The actual deletion happens in the
 * `delete-account` Edge Function, because removing the auth user needs the
 * service role - which is never in the app bundle.
 *
 * The client's job is threefold: make the user mean it, call the function, and
 * leave the device with nothing on it afterwards.
 */

import { getSupabaseClient } from '@/lib/supabase';

/** Typed by the user to confirm. Deliberately not "yes". */
export const CONFIRMATION_WORD = 'DELETE';

/** Case-insensitive, whitespace-forgiving: this is a gate, not a spelling test. */
export function isConfirmed(input: string): boolean {
  return input.trim().toUpperCase() === CONFIRMATION_WORD;
}

export type DeleteAccountErrorCode = 'offline' | 'unauthorized' | 'failed';

export interface DeleteAccountResult {
  ok: boolean;
  code?: DeleteAccountErrorCode;
  message?: string;
  /** What the server says it removed, for the confirmation screen. */
  deleted?: Record<string, number>;
}

const MESSAGES: Record<DeleteAccountErrorCode, string> = {
  offline: 'Deleting an account needs a connection. Try again when you are online.',
  unauthorized: 'Please sign in again before deleting your account.',
  failed: 'Could not delete the account. Nothing has been removed - please try again.',
};

export function describeDeleteError(code: DeleteAccountErrorCode): string {
  return MESSAGES[code];
}

export async function requestAccountDeletion(): Promise<DeleteAccountResult> {
  try {
    const { data, error } = await getSupabaseClient().functions.invoke('delete-account', {
      body: { confirm: CONFIRMATION_WORD },
    });

    if (error) {
      const response = (error as { context?: Response }).context;
      if (!response) {
        return { ok: false, code: 'offline', message: MESSAGES.offline };
      }
      const code: DeleteAccountErrorCode = response.status === 401 ? 'unauthorized' : 'failed';
      return { ok: false, code, message: MESSAGES[code] };
    }

    return { ok: true, deleted: (data as { deleted?: Record<string, number> } | null)?.deleted };
  } catch {
    return { ok: false, code: 'failed', message: MESSAGES.failed };
  }
}
