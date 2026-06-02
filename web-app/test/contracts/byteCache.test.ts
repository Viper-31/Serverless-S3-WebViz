import { describe, expect, it } from 'vitest'
import { createByteCache } from '../../src/lib/byteCache'

describe('byte cache', () => {
  it('uses the memory-only compressed byte cache budget', () => {
    const maxBytes = 96 * 1024 * 1024
    const cache = createByteCache({ maxBytes, maxEntries: 256 })
    cache.set('a', new Uint8Array(10))
    cache.set('b', new Uint8Array(10))
    cache.get('a')
    cache.set('c', new Uint8Array(maxBytes + 1))
    expect(cache.has('c')).toBe(false)
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(true)
  })

  it('evicts least recently used entries until the entry limit passes', () => {
    const cache = createByteCache({ maxBytes: 24, maxEntries: 2 })
    cache.set('a', new Uint8Array(8))
    cache.set('b', new Uint8Array(8))
    cache.get('a')
    cache.set('c', new Uint8Array(8))
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('c')).toBe(true)
  })

  it('evicts least recently used entries until the byte limit passes', () => {
    const cache = createByteCache({ maxBytes: 16, maxEntries: 256 })
    cache.set('a', new Uint8Array(8))
    cache.set('b', new Uint8Array(8))
    cache.get('a')
    cache.set('c', new Uint8Array(8))
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('c')).toBe(true)
  })

  it('updates byte accounting when an existing key is overwritten', () => {
    const cache = createByteCache({ maxBytes: 16, maxEntries: 256 })
    cache.set('a', new Uint8Array(12))
    cache.set('a', new Uint8Array(4))
    cache.set('b', new Uint8Array(12))
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(true)
  })
})
