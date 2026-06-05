import type { ByteCacheOptions, ZarritaCompatibleByteCache } from "./types";

export function createByteCache({ maxBytes, maxEntries }: ByteCacheOptions) {
  const map = new Map<string, Uint8Array>();
  let bytes = 0;

  function touch(key: string, value: Uint8Array) {
    map.delete(key);
    map.set(key, value);
  }

  // Evict least recently used entries until we're under limits
  function evict() {
    while (map.size > maxEntries || bytes > maxBytes) {
      const oldest = map.keys().next().value as string | undefined;
      if (!oldest) break;

      const value = map.get(oldest);
      if (value) bytes -= value.byteLength;
      map.delete(oldest);
    }
  }

  return {
    get(key: string) {
      const value = map.get(key);
      if (!value) return undefined;
      touch(key, value);
      return value;
    },

    has(key: string) {
      return map.has(key);
    },

    set(key: string, value: Uint8Array) {
      if (value.byteLength > maxBytes) return false;

      const existing = map.get(key);
      if (existing) bytes -= existing.byteLength;

      map.set(key, value);
      bytes += value.byteLength;
      touch(key, value);
      evict();
      return true;
    },
  };
}

export function createZarritaByteCache(
  options: ByteCacheOptions,
): ZarritaCompatibleByteCache {
  const cache = createByteCache(options);

  return {
    has: (key) => cache.has(key),
    get: (key) => cache.get(key),
    set: (key, value) => {
      if (value === undefined) {
        // Zarrita uses `undefined` to indicate deletion, but our cache doesn't support that - just ignore it
        return;
      }
      cache.set(key, value);
    },
  };
}
