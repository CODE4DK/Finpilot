import * as SecureStore from 'expo-secure-store';

/**
 * SecureStore refuses values larger than 2048 bytes, and a Supabase session
 * carrying a fat JWT (lots of custom claims, or a Google id_token) goes past
 * that. This adapter transparently splits a large value across numbered
 * chunks and stitches it back together on read.
 *
 * Layout for a chunked value stored under `key`:
 *   key            -> "__chunked__:<count>"
 *   key.0 … key.N  -> the slices, in order
 *
 * A small value is stored as-is under `key`, so existing entries keep working.
 */

/** SecureStore's own limit is 2048 bytes; leave room for the key and encoding. */
export const MAX_CHUNK_SIZE = 1800;

const CHUNK_MARKER = '__chunked__:';

export interface SecureStorageBackend {
  getItemAsync: (key: string, options?: SecureStore.SecureStoreOptions) => Promise<string | null>;
  setItemAsync: (
    key: string,
    value: string,
    options?: SecureStore.SecureStoreOptions,
  ) => Promise<void>;
  deleteItemAsync: (key: string, options?: SecureStore.SecureStoreOptions) => Promise<void>;
}

export function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

export function splitIntoChunks(value: string, size: number = MAX_CHUNK_SIZE): string[] {
  if (size <= 0) {
    throw new Error(`Chunk size must be positive, received: ${size}`);
  }
  const chunks: string[] = [];
  for (let start = 0; start < value.length; start += size) {
    chunks.push(value.slice(start, start + size));
  }
  return chunks;
}

export function parseChunkCount(value: string | null): number | null {
  if (!value?.startsWith(CHUNK_MARKER)) {
    return null;
  }
  const count = Number(value.slice(CHUNK_MARKER.length));
  return Number.isInteger(count) && count > 0 ? count : null;
}

export interface CreateSecureStorageOptions {
  /** Injectable for tests. Defaults to expo-secure-store. */
  backend?: SecureStorageBackend;
  chunkSize?: number;
  secureStoreOptions?: SecureStore.SecureStoreOptions;
}

/**
 * The storage interface supabase-js expects, backed by the device keychain /
 * keystore rather than AsyncStorage - a session is a credential.
 */
export function createSecureStorage(options: CreateSecureStorageOptions = {}) {
  const {
    backend = SecureStore,
    chunkSize = MAX_CHUNK_SIZE,
    secureStoreOptions = {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  } = options;

  async function removeChunks(key: string, count: number): Promise<void> {
    await Promise.all(
      Array.from({ length: count }, (_, index) =>
        backend.deleteItemAsync(chunkKey(key, index), secureStoreOptions),
      ),
    );
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const head = await backend.getItemAsync(key, secureStoreOptions);
      const count = parseChunkCount(head);
      if (count === null) {
        return head;
      }

      const parts = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          backend.getItemAsync(chunkKey(key, index), secureStoreOptions),
        ),
      );

      // A missing slice means the value is unusable - treat it as absent
      // rather than handing back a corrupt session.
      if (parts.some((part) => part === null)) {
        return null;
      }
      return parts.join('');
    },

    async setItem(key: string, value: string): Promise<void> {
      // Clear any previous chunks so a shrinking value cannot leave orphans.
      const previous = parseChunkCount(await backend.getItemAsync(key, secureStoreOptions));
      if (previous !== null) {
        await removeChunks(key, previous);
      }

      if (value.length <= chunkSize) {
        await backend.setItemAsync(key, value, secureStoreOptions);
        return;
      }

      const chunks = splitIntoChunks(value, chunkSize);
      await Promise.all(
        chunks.map((chunk, index) =>
          backend.setItemAsync(chunkKey(key, index), chunk, secureStoreOptions),
        ),
      );
      await backend.setItemAsync(key, `${CHUNK_MARKER}${chunks.length}`, secureStoreOptions);
    },

    async removeItem(key: string): Promise<void> {
      const count = parseChunkCount(await backend.getItemAsync(key, secureStoreOptions));
      if (count !== null) {
        await removeChunks(key, count);
      }
      await backend.deleteItemAsync(key, secureStoreOptions);
    },
  };
}

export type SecureStorage = ReturnType<typeof createSecureStorage>;
