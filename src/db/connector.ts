import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
} from '@powersync/react-native';

import { logWarn } from '@/lib/logger';
import { readEnv } from '@/lib/env';
import { getSupabaseClient, type FinPilotClient } from '@/lib/supabase';

import { classifyUploadError, describeUploadError, type DiscardedUpload } from './upload-errors';
import { nowIso } from './row-mappers';

export interface ConnectorOptions {
  client?: FinPilotClient;
  powersyncUrl?: string;
  /** Somewhere to report discarded writes - Sentry in a later phase. */
  onDiscardedUpload?: (discarded: DiscardedUpload) => void;
}

/**
 * Bridges PowerSync and Supabase:
 *   * `fetchCredentials` hands PowerSync the user's Supabase access token.
 *   * `uploadData` drains the local write queue into PostgREST.
 */
export class SupabaseConnector implements PowerSyncBackendConnector {
  private readonly client: FinPilotClient;
  private readonly powersyncUrl: string;
  private readonly onDiscardedUpload: (discarded: DiscardedUpload) => void;

  constructor(options: ConnectorOptions = {}) {
    this.client = options.client ?? getSupabaseClient();
    this.powersyncUrl = options.powersyncUrl ?? readEnv().powersyncUrl;
    this.onDiscardedUpload =
      options.onDiscardedUpload ??
      ((discarded) => {
        // The reason comes from PostgREST, which quotes the offending values
        // back at you - so it goes through the redactor rather than straight
        // to the console.
        logWarn(
          'powersync',
          `discarded ${discarded.op} on ${discarded.table}#${discarded.rowId}`,
          discarded.reason,
        );
      });
  }

  /**
   * PowerSync calls this whenever it needs a token. supabase-js refreshes the
   * session if it has expired, so this stays current without extra work. A
   * signed-out user returns null: PowerSync then stays disconnected instead of
   * hammering the endpoint with an anonymous token.
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const { data, error } = await this.client.auth.getSession();

    if (error) {
      throw error;
    }
    if (!data.session) {
      return null;
    }

    return {
      endpoint: this.powersyncUrl,
      token: data.session.access_token,
    };
  }

  /**
   * Applies the local write queue, in order, inside one PowerSync transaction.
   *
   * A permanent failure (constraint or RLS violation) is logged and dropped:
   * the queue is strictly ordered, so leaving a row the server will never
   * accept at its head would block every later write on the device forever. A
   * transient failure is rethrown so PowerSync retries with backoff.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    let lastEntry: CrudEntry | null = null;

    try {
      for (const entry of transaction.crud) {
        lastEntry = entry;
        await this.applyEntry(entry);
      }
      await transaction.complete();
    } catch (error) {
      if (classifyUploadError(error) === 'permanent') {
        this.onDiscardedUpload({
          table: lastEntry?.table ?? 'unknown',
          op: lastEntry?.op ?? 'unknown',
          rowId: lastEntry?.id ?? 'unknown',
          reason: describeUploadError(error),
        });
        // Mark it done anyway: the write is lost, but the queue keeps moving.
        await transaction.complete();
        return;
      }
      throw error;
    }
  }

  /** Translates one queued change into a PostgREST call. */
  private async applyEntry(entry: CrudEntry): Promise<void> {
    const table = this.client.from(entry.table as never);

    switch (entry.op) {
      case UpdateType.PUT: {
        const record = { ...entry.opData, id: entry.id };
        const { error } = await table.upsert(record as never);
        if (error) {
          throw error;
        }
        return;
      }

      case UpdateType.PATCH: {
        const { error } = await table.update(entry.opData as never).eq('id', entry.id);
        if (error) {
          throw error;
        }
        return;
      }

      case UpdateType.DELETE: {
        // The schema has no DELETE policy for clients - deletes are soft. A
        // local delete therefore becomes "stamp deleted_at", which also moves
        // the row out of the user's sync bucket so it leaves every device.
        const { error } = await table
          .update({ deleted_at: nowIso(), updated_at: nowIso() } as never)
          .eq('id', entry.id);
        if (error) {
          throw error;
        }
        return;
      }

      default: {
        // An op we do not understand is not worth blocking the queue over.
        throw Object.assign(new Error(`Unknown CRUD op: ${String(entry.op)}`), { code: '22000' });
      }
    }
  }
}
