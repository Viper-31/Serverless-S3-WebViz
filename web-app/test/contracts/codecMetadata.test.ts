import { describe, expect, it } from 'vitest'
import { validateZarrayCodecMetadata } from '../../src/lib/codecMetadata'

describe('codec metadata', () => {
  it('accepts shuffle then zlib with matching elementsize and null compressor', () => {
    expect(validateZarrayCodecMetadata({
      dtype: '<f4',
      compressor: null,
      filters: [{ id: 'shuffle', elementsize: 4 }, { id: 'zlib', level: 7 }],
    })).toBe(true)
  })

  it('rejects unknown filters, wrong order, missing elementsize, and dtype mismatch', () => {
    expect(() => validateZarrayCodecMetadata({ dtype: '<f4', compressor: null, filters: [{ id: 'zlib' }, { id: 'shuffle', elementsize: 4 }] })).toThrow(/order/i)
    expect(() => validateZarrayCodecMetadata({ dtype: '<f4', compressor: null, filters: [{ id: 'shuffle' }] })).toThrow(/elementsize/i)
    expect(() => validateZarrayCodecMetadata({ dtype: '<f8', compressor: null, filters: [{ id: 'shuffle', elementsize: 4 }] })).toThrow(/dtype/i)
    expect(() => validateZarrayCodecMetadata({ dtype: '<f4', compressor: null, filters: [{ id: 'unknown', elementsize: 4 }] })).toThrow(/filter/i)
    expect(() => validateZarrayCodecMetadata({ dtype: '<f4', compressor: { id: 'zlib' }, filters: [{ id: 'shuffle', elementsize: 4 }, { id: 'zlib', level: 7 }] })).toThrow(/compressor/i)
  })
})
