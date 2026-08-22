import { describe, expect, it } from 'vitest'
import { normalizeAudioBlob, sniffAudioMime } from './audioBlob'

const WAV_HEADER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66,
  0x6d, 0x74, 0x20,
])
const MP3_ID3 = new Uint8Array([
  0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
])
const MP3_FRAME = new Uint8Array([
  0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
])
const OGG = new Uint8Array([
  0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
])

describe('sniffAudioMime', () => {
  it('recognizes the common containers by magic bytes', () => {
    expect(sniffAudioMime(WAV_HEADER)).toBe('audio/wav')
    expect(sniffAudioMime(MP3_ID3)).toBe('audio/mpeg')
    expect(sniffAudioMime(MP3_FRAME)).toBe('audio/mpeg')
    expect(sniffAudioMime(OGG)).toBe('audio/ogg')
    expect(
      sniffAudioMime(new TextEncoder().encode('{"error":"nope"}...pad')),
    ).toBeNull()
  })
})

describe('normalizeAudioBlob', () => {
  it('re-types WAV bytes that came back labeled audio/mpeg', async () => {
    // The provider ignored response_format: 'mp3' — the bytes are WAV.
    const lying = new Blob([WAV_HEADER], { type: 'audio/mpeg' })
    const fixed = await normalizeAudioBlob(lying)
    expect(fixed?.type).toBe('audio/wav')
  })

  it('restores the type an OPFS read stripped', async () => {
    const stripped = new Blob([MP3_ID3]) // OPFS hands files back typeless
    const fixed = await normalizeAudioBlob(stripped)
    expect(fixed?.type).toBe('audio/mpeg')
  })

  it('unwraps a JSON envelope carrying base64 audio', async () => {
    const b64 = btoa(String.fromCharCode(...MP3_FRAME)).repeat(30)
    const envelope = new Blob([JSON.stringify({ data: { audio: b64 } })], {
      type: 'application/json',
    })
    const fixed = await normalizeAudioBlob(envelope)
    expect(fixed).not.toBeNull()
    expect(fixed?.type).toBe('audio/mpeg')
    const bytes = new Uint8Array(await fixed!.arrayBuffer())
    expect(bytes[0]).toBe(0xff) // decoded to real MPEG bytes
  })

  it('rejects JSON without audio and empty payloads', async () => {
    expect(
      await normalizeAudioBlob(
        new Blob(['{"error":"quota exceeded"}'], {
          type: 'application/json',
        }),
      ),
    ).toBeNull()
    expect(await normalizeAudioBlob(new Blob([]))).toBeNull()
  })

  it('passes unknown binary through with a default type', async () => {
    const mystery = new Blob([
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
    ])
    const kept = await normalizeAudioBlob(mystery)
    expect(kept?.type).toBe('audio/mpeg')
  })
})
