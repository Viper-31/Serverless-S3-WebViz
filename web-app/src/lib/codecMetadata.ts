type CodecFilter = { id?: string; elementsize?: number; level?: number; [key: string]: unknown }

const WIDTH_BY_DTYPE: Record<string, number> = { '<f4': 4, '<f8': 8, '<i1': 1, '<i2': 2, '<i4': 4, '<i8': 8, '<u1': 1, '<u2': 2, '<u4': 4, '<u8': 8 }

export function validateZarrayCodecMetadata(metadata: { dtype?: string; compressor?: unknown; filters?: CodecFilter[] | null }): true {
  if (metadata.compressor !== null) throw new Error('compressor must be null')
  const filters = metadata.filters ?? []
  if (!Array.isArray(filters)) throw new Error('filters must be an array or null')

  if (filters.length === 0) return true

  let seenZlib = false
  let seenShuffle = false
  for (const filter of filters) {
    if (filter.id === 'shuffle') {
      if (seenZlib) throw new Error('filter order invalid')
      if (seenShuffle) throw new Error('duplicate shuffle filter')
      if (filter.elementsize == null) throw new Error('shuffle elementsize required')
      const expected = metadata.dtype ? WIDTH_BY_DTYPE[metadata.dtype] : undefined
      if (expected == null || expected !== filter.elementsize) throw new Error('dtype mismatch')
      seenShuffle = true
    } else if (filter.id === 'zlib') {
      if (!seenShuffle) throw new Error('filter order invalid')
      if (seenZlib) throw new Error('duplicate zlib filter')
      seenZlib = true
    } else {
      throw new Error('unknown filter')
    }
  }

  if (!seenShuffle || !seenZlib) throw new Error('filters must include shuffle then zlib')
  return true
}
