import { formatLastSynced, summariseSyncStatus, toSyncState } from '@/db/sync-status';

describe('toSyncState', () => {
  it('is offline with no status at all', () => {
    expect(toSyncState(null)).toBe('offline');
    expect(toSyncState(undefined)).toBe('offline');
  });

  it('is offline when disconnected and not trying', () => {
    expect(toSyncState({ connected: false, connecting: false })).toBe('offline');
  });

  it('is syncing while connecting', () => {
    expect(toSyncState({ connected: false, connecting: true })).toBe('syncing');
  });

  it('is syncing while data is moving', () => {
    expect(
      toSyncState({ connected: true, hasSynced: true, dataFlowStatus: { downloading: true } }),
    ).toBe('syncing');
    expect(
      toSyncState({ connected: true, hasSynced: true, dataFlowStatus: { uploading: true } }),
    ).toBe('syncing');
  });

  it('is syncing when connected but the first sync has not landed', () => {
    expect(toSyncState({ connected: true, hasSynced: false })).toBe('syncing');
  });

  it('is synced when connected, caught up and idle', () => {
    expect(toSyncState({ connected: true, hasSynced: true, dataFlowStatus: {} })).toBe('synced');
  });

  it('surfaces an error even while connected - uploads can fail while downloads work', () => {
    expect(
      toSyncState({
        connected: true,
        hasSynced: true,
        dataFlowStatus: { uploadError: new Error('nope') },
      }),
    ).toBe('error');
    expect(
      toSyncState({ connected: false, dataFlowStatus: { downloadError: new Error('nope') } }),
    ).toBe('error');
  });
});

describe('summariseSyncStatus', () => {
  it('gives every state a human label', () => {
    for (const status of [
      null,
      { connected: true, hasSynced: true, dataFlowStatus: {} },
      { connected: false, connecting: true },
      { connected: true, dataFlowStatus: { uploadError: new Error('x') } },
    ]) {
      expect(summariseSyncStatus(status).label.length).toBeGreaterThan(0);
    }
  });

  it('reports pending uploads', () => {
    expect(
      summariseSyncStatus({ connected: true, hasSynced: true, dataFlowStatus: { uploading: true } })
        .pendingUpload,
    ).toBe(true);
    expect(
      summariseSyncStatus({ connected: true, hasSynced: true, dataFlowStatus: {} }).pendingUpload,
    ).toBe(false);
  });

  it('carries the last sync time through', () => {
    const lastSyncedAt = new Date('2026-09-19T10:00:00.000Z');
    expect(
      summariseSyncStatus({ connected: true, hasSynced: true, lastSyncedAt }).lastSyncedAt,
    ).toBe(lastSyncedAt);
  });

  it('tells an offline user their changes are safe', () => {
    expect(summariseSyncStatus({ connected: false }).label).toContain('saved on this device');
  });
});

describe('formatLastSynced', () => {
  const now = new Date('2026-09-19T12:00:00.000Z');

  it.each([
    [new Date('2026-09-19T11:59:40.000Z'), 'Synced just now'],
    [new Date('2026-09-19T11:57:00.000Z'), 'Synced 3 min ago'],
    [new Date('2026-09-19T11:00:00.000Z'), 'Synced 1 hour ago'],
    [new Date('2026-09-19T07:00:00.000Z'), 'Synced 5 hours ago'],
    [new Date('2026-09-18T12:00:00.000Z'), 'Synced yesterday'],
    [new Date('2026-09-16T12:00:00.000Z'), 'Synced 3 days ago'],
  ])('describes %s as %s', (lastSyncedAt, expected) => {
    expect(formatLastSynced(lastSyncedAt, now)).toBe(expected);
  });

  it('says so when nothing has synced yet', () => {
    expect(formatLastSynced(null, now)).toBe('Not synced yet');
  });

  it('never reports a negative age from a clock skew', () => {
    expect(formatLastSynced(new Date('2026-09-19T12:05:00.000Z'), now)).toBe('Synced just now');
  });
});
