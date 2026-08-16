/**
 * Stitch scene clips into one draft MP4 with ffmpeg.wasm.
 *
 * The ~31 MB ffmpeg core is loaded LAZILY from a CDN the first time the user
 * asks for a stitched draft — normal app loads never pay for it. Stream-copy
 * concatenation is used (no re-encode): instant and lossless when all clips
 * share codec/resolution (the normal case — same model and settings). Mixed
 * clips fail with a clear error; the clips zip remains the fallback.
 */

const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'

export type StitchProgress =
  { phase: 'loading-engine' } | { phase: 'stitching' }

export class StitchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StitchError'
  }
}

/** Build the ffmpeg concat-demuxer list for N clip files (pure; tested). */
export function buildConcatList(count: number): string {
  return Array.from(
    { length: count },
    (_, i) => `file 'clip-${String(i)}.mp4'`,
  ).join('\n')
}

export async function stitchClips(
  clips: Blob[],
  onProgress: (progress: StitchProgress) => void,
): Promise<Blob> {
  if (clips.length === 0) {
    throw new StitchError('There are no clips to stitch yet.')
  }
  onProgress({ phase: 'loading-engine' })

  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ])
  const ffmpeg = new FFmpeg()
  try {
    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${FFMPEG_CORE_BASE}/ffmpeg-core.js`,
        'text/javascript',
      ),
      wasmURL: await toBlobURL(
        `${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`,
        'application/wasm',
      ),
    })
  } catch {
    throw new StitchError(
      'The video engine could not be downloaded. Check your connection and try again — or use the clips zip instead.',
    )
  }

  onProgress({ phase: 'stitching' })
  try {
    for (let i = 0; i < clips.length; i += 1) {
      const clip = clips[i]
      if (clip === undefined) continue
      await ffmpeg.writeFile(
        `clip-${String(i)}.mp4`,
        new Uint8Array(await clip.arrayBuffer()),
      )
    }
    await ffmpeg.writeFile(
      'list.txt',
      new TextEncoder().encode(buildConcatList(clips.length)),
    )
    const code = await ffmpeg.exec([
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      'list.txt',
      '-c',
      'copy',
      'draft.mp4',
    ])
    if (code !== 0) {
      throw new StitchError(
        'The clips could not be stitched (they may use different codecs or resolutions). Use the clips zip and assemble them in your editor instead.',
      )
    }
    const data = await ffmpeg.readFile('draft.mp4')
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : data
    const copy = new Uint8Array(bytes.length)
    copy.set(bytes)
    return new Blob([copy.buffer], { type: 'video/mp4' })
  } catch (error) {
    if (error instanceof StitchError) throw error
    throw new StitchError(
      'Stitching failed unexpectedly. Use the clips zip and assemble them in your editor instead.',
    )
  } finally {
    ffmpeg.terminate()
  }
}
