/**
 * The four states worth showing a user, derived from PowerSync's status.
 * Kept pure so the mapping is unit tested rather than eyeballed on a device.
 */

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

export interface SyncStatusLike {
  connected?: boolean;
  connecting?: boolean;
  /** True once the first full sync has landed. */
  hasSynced?: boolean;
  dataFlowStatus?: {
    downloading?: boolean;
    uploading?: boolean;
    downloadError?: unknown;
    uploadError?: unknown;
  };
  lastSyncedAt?: Date | null;
}

export interface SyncSummary {
  state: SyncState;
  /** One short line for the indicator's accessibility label. */
  label: string;
  lastSyncedAt: Date | null;
  /** True while there are local writes the server has not accepted yet. */
  pendingUpload: boolean;
}

export function toSyncState(status: SyncStatusLike | null | undefined): SyncState {
  if (!status) {
    return 'offline';
  }

  const flow = status.dataFlowStatus ?? {};

  // An error is worth surfacing even while connected: uploads may be failing
  // while downloads still work.
  if (flow.downloadError || flow.uploadError) {
    return 'error';
  }

  if (!status.connected) {
    return status.connecting ? 'syncing' : 'offline';
  }

  if (flow.downloading || flow.uploading) {
    return 'syncing';
  }

  // Connected but the first sync has not completed yet.
  return status.hasSynced ? 'synced' : 'syncing';
}

const LABELS: Record<SyncState, string> = {
  synced: 'All changes saved',
  syncing: 'Syncing',
  offline: 'Offline — changes saved on this device',
  error: 'Sync problem — tap for details',
};

export function summariseSyncStatus(status: SyncStatusLike | null | undefined): SyncSummary {
  const state = toSyncState(status);
  const flow = status?.dataFlowStatus ?? {};
  return {
    state,
    label: LABELS[state],
    lastSyncedAt: status?.lastSyncedAt ?? null,
    pendingUpload: Boolean(flow.uploading || flow.uploadError),
  };
}

/** "just now", "3 min ago", "yesterday" - for the status detail sheet. */
export function formatLastSynced(lastSyncedAt: Date | null, now: Date = new Date()): string {
  if (!lastSyncedAt) {
    return 'Not synced yet';
  }

  const seconds = Math.max(0, Math.floor((now.getTime() - lastSyncedAt.getTime()) / 1000));
  if (seconds < 45) {
    return 'Synced just now';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `Synced ${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `Synced ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? 'Synced yesterday' : `Synced ${days} days ago`;
}
