/**
 * Triage for upload failures.
 *
 * The upload queue is strictly ordered: PowerSync retries the head of the
 * queue until it succeeds. That is right for a flaky network and wrong for a
 * row the server will never accept - a constraint violation retried forever
 * blocks every later write on the device.
 *
 * So each failure is classified:
 *   * transient  -> rethrow, PowerSync retries with backoff
 *   * permanent  -> log and discard the entry, the queue moves on
 */

export type UploadFailureKind = 'transient' | 'permanent';

/** The shape of a PostgREST error, plus whatever fetch throws. */
export interface UploadErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
  name?: string;
}

/**
 * Postgres SQLSTATE classes that will never succeed on retry:
 *   22xxx data exception (bad type, out of range)
 *   23xxx integrity constraint violation (check, FK, unique, not-null)
 *   42xxx syntax error or access rule violation - 42501 is an RLS refusal
 */
const PERMANENT_SQLSTATE_CLASSES = ['22', '23', '42'];

/** PostgREST's own codes for a malformed or unauthorised request. */
const PERMANENT_HTTP_STATUSES = new Set([400, 401, 403, 404, 405, 409, 413, 422]);

export function classifyUploadError(error: unknown): UploadFailureKind {
  if (error === null || error === undefined) {
    return 'transient';
  }

  const candidate = error as UploadErrorLike;

  const sqlState = candidate.code;
  if (typeof sqlState === 'string' && /^\d{5}$/.test(sqlState)) {
    return PERMANENT_SQLSTATE_CLASSES.includes(sqlState.slice(0, 2)) ? 'permanent' : 'transient';
  }

  if (typeof candidate.status === 'number') {
    // 401 is ambiguous: an expired token is transient, but by the time an
    // upload runs the connector has already refreshed credentials, so treat a
    // persistent 401 as permanent rather than looping on it.
    return PERMANENT_HTTP_STATUSES.has(candidate.status) ? 'permanent' : 'transient';
  }

  // A thrown TypeError from fetch, a timeout, a dropped socket: all worth
  // retrying. Anything unrecognised is treated as transient too, because
  // discarding a write we do not understand loses the user's data.
  return 'transient';
}

export function isPermanentUploadError(error: unknown): boolean {
  return classifyUploadError(error) === 'permanent';
}

export interface DiscardedUpload {
  table: string;
  op: string;
  rowId: string;
  reason: string;
}

/** A one-line description for the log; never contains the row's values. */
export function describeUploadError(error: unknown): string {
  const candidate = (error ?? {}) as UploadErrorLike;
  const parts = [
    candidate.code ? `code=${candidate.code}` : null,
    candidate.status ? `status=${candidate.status}` : null,
    candidate.message ?? candidate.name ?? 'unknown error',
  ].filter(Boolean);
  return parts.join(' ');
}
