export function createByteCache({ maxBytes, maxEntries }: { maxBytes: number; maxEntries: number }) {
  const map = new Map<string, Uint8Array>()
  let bytes = 0

  function touch(key: string, value: Uint8Array) {
    map.delete(key)
    map.set(key, value)
  }

  function evict() {
    while (map.size > maxEntries || bytes > maxBytes) {
      const oldest = map.keys().next().value as string | undefined
      if (!oldest) break
      const value = map.get(oldest)
      if (value) bytes -= value.byteLength
      map.delete(oldest)
    }
  }

  return {
    get(key: string) {
      const value = map.get(key)
      if (!value) return undefined
      touch(key, value)
      return value
    },
    has(key: string) { return map.has(key) },
    set(key: string, value: Uint8Array) {
      if (value.byteLength > maxBytes) return false
      const existing = map.get(key)
      if (existing) bytes -= existing.byteLength
      map.set(key, value)
      bytes += value.byteLength
      touch(key, value)
      evict()
      return true
    },
  }
}
