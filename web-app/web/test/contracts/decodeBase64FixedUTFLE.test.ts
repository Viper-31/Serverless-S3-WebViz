import { describe, expect, it } from 'vitest'
import { decodeBase64FixedUTFLE } from '../../src/lib/decodeBase64FixedUTFLE'

function encodeFixedUtf32LE(values: string[], width: number) {
  const bytes = new Uint8Array(values.length * width * 4)
  const view = new DataView(bytes.buffer)
  let offset = 0
  for (const value of values) {
    const codePoints = Array.from(value, (char) => char.codePointAt(0) ?? 0)
    for (let i = 0; i < width; i += 1) {
      view.setUint32(offset, codePoints[i] ?? 0, true)
      offset += 4
    }
  }
  return `base64:${Buffer.from(bytes).toString('base64')}`
}

describe('decodeBase64FixedUTFLE', () => {
  it('decodes representative DPIRD station strings with null padding', () => {
    const encoded = encodeFixedUtf32LE(['Binnu', 'Perth Metro'], 22)
    expect(decodeBase64FixedUTFLE(encoded, 22)).toEqual(['Binnu', 'Perth Metro'])
  })

  it('decodes representative DPIRD code strings and allows empty padded values', () => {
    const encoded = encodeFixedUtf32LE(['BINNU', ''], 5)
    expect(decodeBase64FixedUTFLE(encoded, 5)).toEqual(['BINNU', ''])
  })

  it('rejects missing base64 prefix', () => {
    expect(() => decodeBase64FixedUTFLE('QQAAAA==', 4)).toThrow(/base64:/i)
  })

  it('rejects decoded byte length not divisible by four', () => {
    expect(() => decodeBase64FixedUTFLE('base64:QQ==', 4)).toThrow(/4/i)
  })

  it('rejects code point count not divisible by width', () => {
    expect(() => decodeBase64FixedUTFLE('base64:QQAAAA==', 2)).toThrow(/width/i)
  })

  it('rejects non-positive width', () => {
    expect(() => decodeBase64FixedUTFLE('base64:QQAAAA==', 0)).toThrow(/width/i)
  })
})
