export function decodeBase64FixedUTFLE(encoded: string, width: number): string[] {
  if (!encoded.startsWith('base64:')) throw new Error('Expected base64: prefix')
  if (width <= 0) throw new Error('width must be positive')

  const binary = atob(encoded.slice(7))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  if (bytes.byteLength % 4 !== 0) throw new Error('Decoded byte length must be divisible by 4')

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const codePoints: number[] = []
  for (let offset = 0; offset < bytes.byteLength; offset += 4) codePoints.push(view.getUint32(offset, true))

  if (codePoints.length % width !== 0) throw new Error('Code point count must be divisible by width')

  const out: string[] = []
  for (let i = 0; i < codePoints.length; i += width) {
    const chunk = codePoints.slice(i, i + width)
    const chars: string[] = []
    for (const cp of chunk) {
      if (cp === 0) break
      chars.push(String.fromCodePoint(cp))
    }
    out.push(chars.join(''))
  }
  return out
}
