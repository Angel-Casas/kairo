/**
 * Audio blob normalization (Slice 15.9.1). The /v1/audio/speech endpoint
 * fronts many providers, and not all of them honor `response_format: 'mp3'`:
 * Angel observed some models' audio playing fine while others were silent.
 * Two failure shapes hide behind that:
 *
 *  - the bytes are real audio but a DIFFERENT container (WAV/OGG/FLAC/M4A),
 *    or the response's Content-Type lies — the `<audio>` element then picks
 *    the wrong demuxer and fails without an error;
 *  - the response is a JSON envelope carrying base64 audio instead of raw
 *    bytes (same family of surprise as the video endpoint's relative URLs).
 *
 * So: trust the BYTES, not the headers. Sniff the container from magic
 * numbers and re-type the blob; unwrap JSON/base64 envelopes first.
 */

/** Detect the audio container from magic bytes; null when unrecognized. */
export function sniffAudioMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end))
  // WAV: "RIFF" .... "WAVE"
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav'
  // OGG: "OggS"
  if (ascii(0, 4) === 'OggS') return 'audio/ogg'
  // FLAC: "fLaC"
  if (ascii(0, 4) === 'fLaC') return 'audio/flac'
  // MP4/M4A: "ftyp" at offset 4
  if (ascii(4, 8) === 'ftyp') return 'audio/mp4'
  // MP3: ID3 tag, or a bare MPEG frame sync (0xFF 0xEx/0xFx)
  if (ascii(0, 3) === 'ID3') return 'audio/mpeg'
  const b0 = bytes[0]
  const b1 = bytes[1]
  if (b0 === 0xff && b1 !== undefined && (b1 & 0xe0) === 0xe0) {
    return 'audio/mpeg'
  }
  return null
}

/** Depth-first hunt for a plausible base64 audio payload in a JSON value. */
function findBase64Audio(node: unknown, depth = 0): string | null {
  if (depth > 4 || node === null) return null
  if (typeof node === 'string') {
    // Long base64-looking string (data URLs included).
    const raw = node.startsWith('data:') ? (node.split(',')[1] ?? '') : node
    if (raw.length > 256 && /^[A-Za-z0-9+/=\s]+$/.test(raw)) return raw
    return null
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findBase64Audio(item, depth + 1)
      if (found !== null) return found
    }
    return null
  }
  if (typeof node === 'object') {
    // Try audio-suggestive keys first, then everything.
    const record = node as Record<string, unknown>
    const keys = Object.keys(record).sort((a, b) => {
      const score = (k: string) => (/audio|b64|data|content/i.test(k) ? 0 : 1)
      return score(a) - score(b)
    })
    for (const key of keys) {
      const found = findBase64Audio(record[key], depth + 1)
      if (found !== null) return found
    }
  }
  return null
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const binary = atob(b64.replace(/\s+/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

/**
 * Normalize a TTS response (or a cached copy, whose OPFS read strips the
 * MIME type) into a playable, correctly-typed audio blob.
 * Returns null when the payload holds no recognizable audio at all.
 */
export async function normalizeAudioBlob(blob: Blob): Promise<Blob | null> {
  if (blob.size === 0) return null
  const bytes = new Uint8Array(await blob.arrayBuffer())

  const sniffed = sniffAudioMime(bytes)
  if (sniffed !== null) {
    return blob.type === sniffed ? blob : new Blob([bytes], { type: sniffed })
  }

  // Not a known container — maybe a JSON envelope with base64 audio.
  const looksTexty =
    /json|text/i.test(blob.type) ||
    bytes[0] === 0x7b || // '{'
    bytes[0] === 0x5b // '['
  if (looksTexty && blob.size < 50_000_000) {
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
      const b64 = findBase64Audio(parsed)
      if (b64 !== null) {
        const decoded = base64ToBytes(b64)
        if (decoded !== null) {
          const innerSniff = sniffAudioMime(decoded)
          return new Blob([decoded as BlobPart], {
            type: innerSniff ?? 'audio/mpeg',
          })
        }
      }
      return null // JSON without audio — an error payload, not narration.
    } catch {
      // Not JSON after all; fall through.
    }
  }

  if (looksTexty) return null // Plain text/HTML is never audio.

  // Unknown binary: keep the bytes, defaulting the type so <audio> at
  // least tries the common demuxer (the pre-15.9.1 behavior).
  return blob.type.length > 0 ? blob : new Blob([bytes], { type: 'audio/mpeg' })
}

/**
 * Final gate before trusting bytes as a playable preview (15.9.2): ask the
 * browser's real audio decoder. Catches junk that slips past the sniffer —
 * e.g. a provider streaming raw PCM or proprietary bytes under an audio
 * Content-Type (ByteDance Seed Audio did exactly that; billed, cached,
 * silent). Environments without WebAudio (jsdom) skip the check.
 */
export async function isPlayableAudio(blob: Blob): Promise<boolean> {
  const Ctx =
    typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : undefined
  if (Ctx === undefined) return true
  try {
    const ctx = new Ctx(1, 1, 44100)
    await ctx.decodeAudioData(await blob.arrayBuffer())
    return true
  } catch {
    return false
  }
}

/**
 * Duration of an audio blob in seconds, via the browser's decoder
 * (15.11 — animate-all fits clip lengths to narration). Null where
 * WebAudio is unavailable (jsdom) or the bytes don't decode.
 */
export async function audioBlobDuration(blob: Blob): Promise<number | null> {
  const Ctx =
    typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : undefined
  if (Ctx === undefined) return null
  try {
    const ctx = new Ctx(1, 1, 44100)
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
    return buffer.duration
  } catch {
    return null
  }
}
