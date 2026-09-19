import { UpdateType } from '@powersync/react-native';

import { SupabaseConnector } from '@/db/connector';

const POWERSYNC_URL = 'https://instance.powersync.journeyapps.com';

/** A PostgREST-shaped query builder that records what the connector asked for. */
function createTableStub() {
  const calls: { op: string; payload?: unknown; id?: string }[] = [];
  let failure: unknown = null;

  const builder = {
    calls,
    failWith(error: unknown) {
      failure = error;
    },
    upsert(payload: unknown) {
      calls.push({ op: 'upsert', payload });
      return Promise.resolve({ error: failure });
    },
    update(payload: unknown) {
      calls.push({ op: 'update', payload });
      return {
        eq: (_column: string, id: string) => {
          calls[calls.length - 1]!.id = id;
          return Promise.resolve({ error: failure });
        },
      };
    },
  };

  return builder;
}

function createClientStub(session: { access_token: string } | null = { access_token: 'token' }) {
  const table = createTableStub();
  return {
    table,
    from: jest.fn(() => table),
    auth: {
      getSession: jest.fn(async () => ({ data: { session }, error: null })),
    },
  };
}

function createTransaction(entries: unknown[]) {
  return {
    crud: entries,
    complete: jest.fn(async () => {}),
  };
}

function createDatabaseStub(transaction: unknown) {
  return { getNextCrudTransaction: jest.fn(async () => transaction) };
}

function makeConnector(client: ReturnType<typeof createClientStub>, onDiscarded = jest.fn()) {
  return {
    connector: new SupabaseConnector({
      client: client as never,
      powersyncUrl: POWERSYNC_URL,
      onDiscardedUpload: onDiscarded,
    }),
    onDiscarded,
  };
}

describe('fetchCredentials', () => {
  it('hands PowerSync the current access token', async () => {
    const client = createClientStub({ access_token: 'access-123' });
    const { connector } = makeConnector(client);

    await expect(connector.fetchCredentials()).resolves.toEqual({
      endpoint: POWERSYNC_URL,
      token: 'access-123',
    });
  });

  it('returns null when signed out, so PowerSync stays disconnected', async () => {
    const client = createClientStub(null);
    const { connector } = makeConnector(client);

    await expect(connector.fetchCredentials()).resolves.toBeNull();
  });

  it('rethrows a session error rather than syncing anonymously', async () => {
    const client = createClientStub();
    client.auth.getSession = jest.fn(async () => ({
      data: { session: null },
      error: new Error('session read failed'),
    })) as never;
    const { connector } = makeConnector(client);

    await expect(connector.fetchCredentials()).rejects.toThrow('session read failed');
  });
});

describe('uploadData', () => {
  it('does nothing when the queue is empty', async () => {
    const client = createClientStub();
    const { connector } = makeConnector(client);
    const database = createDatabaseStub(null);

    await connector.uploadData(database as never);

    expect(client.from).not.toHaveBeenCalled();
  });

  it('sends a PUT as an upsert carrying the client id', async () => {
    const client = createClientStub();
    const { connector } = makeConnector(client);
    const transaction = createTransaction([
      {
        op: UpdateType.PUT,
        table: 'transactions',
        id: 'row-1',
        opData: { amount_paise: 184550, type: 'expense' },
      },
    ]);

    await connector.uploadData(createDatabaseStub(transaction) as never);

    expect(client.table.calls[0]).toEqual({
      op: 'upsert',
      payload: { amount_paise: 184550, type: 'expense', id: 'row-1' },
    });
    expect(transaction.complete).toHaveBeenCalled();
  });

  it('sends a PATCH as an update scoped to the row', async () => {
    const client = createClientStub();
    const { connector } = makeConnector(client);
    const transaction = createTransaction([
      { op: UpdateType.PATCH, table: 'accounts', id: 'acc-1', opData: { name: 'Renamed' } },
    ]);

    await connector.uploadData(createDatabaseStub(transaction) as never);

    expect(client.table.calls[0]).toEqual({
      op: 'update',
      payload: { name: 'Renamed' },
      id: 'acc-1',
    });
  });

  it('turns a DELETE into a soft delete, because the server allows no other kind', async () => {
    const client = createClientStub();
    const { connector } = makeConnector(client);
    const transaction = createTransaction([
      { op: UpdateType.DELETE, table: 'transactions', id: 'row-1' },
    ]);

    await connector.uploadData(createDatabaseStub(transaction) as never);

    const call = client.table.calls[0]!;
    expect(call.op).toBe('update');
    expect(call.id).toBe('row-1');
    const payload = call.payload as { deleted_at: string; updated_at: string };
    expect(payload.deleted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('applies every entry in the transaction, in order', async () => {
    const client = createClientStub();
    const { connector } = makeConnector(client);
    const transaction = createTransaction([
      { op: UpdateType.PUT, table: 'accounts', id: 'acc-1', opData: { name: 'A' } },
      { op: UpdateType.PATCH, table: 'accounts', id: 'acc-1', opData: { name: 'B' } },
      { op: UpdateType.DELETE, table: 'accounts', id: 'acc-1' },
    ]);

    await connector.uploadData(createDatabaseStub(transaction) as never);

    expect(client.table.calls.map((call) => call.op)).toEqual(['upsert', 'update', 'update']);
    expect(transaction.complete).toHaveBeenCalledTimes(1);
  });

  it('rethrows a transient failure so PowerSync retries it', async () => {
    const client = createClientStub();
    client.table.failWith({ status: 503, message: 'service unavailable' });
    const { connector, onDiscarded } = makeConnector(client);
    const transaction = createTransaction([
      { op: UpdateType.PUT, table: 'accounts', id: 'acc-1', opData: { name: 'A' } },
    ]);

    await expect(
      connector.uploadData(createDatabaseStub(transaction) as never),
    ).rejects.toBeDefined();

    // The entry stays queued for the retry.
    expect(transaction.complete).not.toHaveBeenCalled();
    expect(onDiscarded).not.toHaveBeenCalled();
  });

  it('discards a constraint violation so one bad row cannot block the queue', async () => {
    const client = createClientStub();
    client.table.failWith({ code: '23514', message: 'amount must be positive' });
    const { connector, onDiscarded } = makeConnector(client);
    const transaction = createTransaction([
      { op: UpdateType.PUT, table: 'transactions', id: 'row-1', opData: { amount_paise: -1 } },
    ]);

    await expect(
      connector.uploadData(createDatabaseStub(transaction) as never),
    ).resolves.toBeUndefined();

    expect(transaction.complete).toHaveBeenCalled();
    expect(onDiscarded).toHaveBeenCalledWith({
      table: 'transactions',
      op: UpdateType.PUT,
      rowId: 'row-1',
      reason: 'code=23514 amount must be positive',
    });
  });

  it('discards an RLS refusal the same way', async () => {
    const client = createClientStub();
    client.table.failWith({ code: '42501', message: 'new row violates row-level security policy' });
    const { connector, onDiscarded } = makeConnector(client);
    const transaction = createTransaction([
      { op: UpdateType.PATCH, table: 'accounts', id: 'acc-1', opData: { user_id: 'someone-else' } },
    ]);

    await connector.uploadData(createDatabaseStub(transaction) as never);

    expect(onDiscarded).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'accounts', rowId: 'acc-1' }),
    );
    expect(transaction.complete).toHaveBeenCalled();
  });

  it('names the entry that failed, not the first one in the transaction', async () => {
    const client = createClientStub();
    const { connector, onDiscarded } = makeConnector(client);
    const transaction = createTransaction([
      { op: UpdateType.PUT, table: 'accounts', id: 'acc-1', opData: { name: 'A' } },
      { op: UpdateType.PUT, table: 'transactions', id: 'row-2', opData: { amount_paise: -1 } },
    ]);

    // Fail only once the second entry is reached.
    let seen = 0;
    client.table.upsert = ((payload: unknown) => {
      client.table.calls.push({ op: 'upsert', payload });
      seen += 1;
      return Promise.resolve({
        error: seen === 2 ? { code: '23514', message: 'amount must be positive' } : null,
      });
    }) as never;

    await connector.uploadData(createDatabaseStub(transaction) as never);

    expect(onDiscarded).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'transactions', rowId: 'row-2' }),
    );
  });
});
