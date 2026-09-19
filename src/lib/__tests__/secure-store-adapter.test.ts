import {
  MAX_CHUNK_SIZE,
  chunkKey,
  createSecureStorage,
  parseChunkCount,
  splitIntoChunks,
  type SecureStorageBackend,
} from '@/lib/secure-store-adapter';

/** An in-memory stand-in for expo-secure-store that enforces its size limit. */
function createFakeBackend(limit = 2048) {
  const store = new Map<string, string>();
  const backend: SecureStorageBackend = {
    getItemAsync: async (key) => store.get(key) ?? null,
    setItemAsync: async (key, value) => {
      if (value.length > limit) {
        throw new Error(`Value too large for SecureStore: ${value.length} > ${limit}`);
      }
      store.set(key, value);
    },
    deleteItemAsync: async (key) => {
      store.delete(key);
    },
  };
  return { backend, store };
}

describe('splitIntoChunks', () => {
  it('returns one chunk for a short value', () => {
    expect(splitIntoChunks('hello', 10)).toEqual(['hello']);
  });

  it('splits on the boundary without losing characters', () => {
    const chunks = splitIntoChunks('abcdefghij', 4);
    expect(chunks).toEqual(['abcd', 'efgh', 'ij']);
    expect(chunks.join('')).toBe('abcdefghij');
  });

  it('rejects a non-positive size', () => {
    expect(() => splitIntoChunks('abc', 0)).toThrow();
  });
});

describe('parseChunkCount', () => {
  it('recognises the marker', () => {
    expect(parseChunkCount('__chunked__:3')).toBe(3);
  });

  it.each([null, '', 'a plain value', '__chunked__:0', '__chunked__:abc'])(
    'returns null for %p',
    (value) => {
      expect(parseChunkCount(value)).toBeNull();
    },
  );
});

describe('chunkKey', () => {
  it('numbers the slices', () => {
    expect(chunkKey('session', 2)).toBe('session.2');
  });
});

describe('createSecureStorage', () => {
  it('round-trips a small value untouched', async () => {
    const { backend, store } = createFakeBackend();
    const storage = createSecureStorage({ backend });

    await storage.setItem('session', 'small');
    expect(await storage.getItem('session')).toBe('small');
    // Stored as-is, not chunked.
    expect(store.get('session')).toBe('small');
  });

  it('round-trips a value larger than the SecureStore limit', async () => {
    const { backend, store } = createFakeBackend();
    const storage = createSecureStorage({ backend });
    const big = 'x'.repeat(MAX_CHUNK_SIZE * 3 + 17);

    await storage.setItem('session', big);

    expect(store.get('session')).toBe('__chunked__:4');
    expect(await storage.getItem('session')).toBe(big);
  });

  it('never writes a slice past the backend limit', async () => {
    const { backend } = createFakeBackend(2048);
    const storage = createSecureStorage({ backend });

    // A realistic oversized session payload.
    await expect(
      storage.setItem('session', JSON.stringify({ token: 'y'.repeat(9000) })),
    ).resolves.toBeUndefined();
  });

  it('cleans up orphaned slices when a value shrinks', async () => {
    const { backend, store } = createFakeBackend();
    const storage = createSecureStorage({ backend });

    await storage.setItem('session', 'z'.repeat(MAX_CHUNK_SIZE * 3));
    await storage.setItem('session', 'now small');

    expect(await storage.getItem('session')).toBe('now small');
    expect([...store.keys()]).toEqual(['session']);
  });

  it('removes every slice on removeItem', async () => {
    const { backend, store } = createFakeBackend();
    const storage = createSecureStorage({ backend });

    await storage.setItem('session', 'z'.repeat(MAX_CHUNK_SIZE * 2));
    await storage.removeItem('session');

    expect(store.size).toBe(0);
    expect(await storage.getItem('session')).toBeNull();
  });

  it('treats a partially written value as absent rather than corrupt', async () => {
    const { backend, store } = createFakeBackend();
    const storage = createSecureStorage({ backend });

    await storage.setItem('session', 'z'.repeat(MAX_CHUNK_SIZE * 2));
    store.delete('session.1');

    expect(await storage.getItem('session')).toBeNull();
  });

  it('returns null for a key that was never written', async () => {
    const { backend } = createFakeBackend();
    const storage = createSecureStorage({ backend });

    expect(await storage.getItem('missing')).toBeNull();
  });
});
