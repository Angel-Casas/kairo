/**
 * Final-frame extraction (Slice 21, "the handoff"): sample the closing
 * moments of a clip client-side — a hidden <video> seeked frame by frame
 * onto a canvas — so the next scene can start exactly where this one
 * ended. Free: no generation, no upload, the clip never leaves the
 * browser.
 *
 * The literal last frame is often the worst one (motion blur, a
 * mid-blink, encoder smear), so we grab a small window of candidates and
 * score each with a cheap gradient-energy measure; the UI preselects the
 * sharpest and lets the user overrule it.
 */

export interface GrabbedFrame {
  blob: Blob
  /** Seconds into the clip this frame was taken at. */
  time: number
  /** Relative sharpness (gradient energy); higher is crisper. */
  sharpness: number
}

/** Gradient energy on a small grayscale copy — enough to rank blur. */
function sharpnessScore(data: ImageData): number {
  const { data: px, width, height } = data
  let energy = 0
  // Luma gradient magnitude, sampled on a stride to stay cheap.
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = (y * width + x) * 4
      const l = px[i]! * 0.299 + px[i + 1]! * 0.587 + px[i + 2]! * 0.114
      const ir = i + 8 // two px right (stride 2)
      const id = i + width * 8 // two px down
      const lr = px[ir]! * 0.299 + px[ir + 1]! * 0.587 + px[ir + 2]! * 0.114
      const ld = px[id]! * 0.299 + px[id + 1]! * 0.587 + px[id + 2]! * 0.114
      energy += Math.abs(l - lr) + Math.abs(l - ld)
    }
  }
  return energy / (width * height)
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('The clip could not be decoded.'))
    }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    video.currentTime = time
  })
}

/**
 * Grab up to `count` frames from the last `windowSeconds` of the clip,
 * oldest first. Throws when the browser cannot decode the video.
 */
export async function extractFinalFrames(
  clip: Blob,
  { count = 8, windowSeconds = 0.8 } = {},
): Promise<GrabbedFrame[]> {
  const url = URL.createObjectURL(clip)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  try {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup()
        resolve()
      }
      const onError = () => {
        cleanup()
        reject(new Error('The clip could not be decoded.'))
      }
      const cleanup = () => {
        video.removeEventListener('loadeddata', onReady)
        video.removeEventListener('error', onError)
      }
      video.addEventListener('loadeddata', onReady)
      video.addEventListener('error', onError)
      video.src = url
    })

    const duration = video.duration
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('The clip reports no duration.')
    }
    const width = video.videoWidth
    const height = video.videoHeight
    if (width === 0 || height === 0) {
      throw new Error('The clip has no video track.')
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    // A small grayscale-ish copy for scoring: cheap and blur-sensitive.
    const scoreCanvas = document.createElement('canvas')
    const scoreW = 96
    const scoreH = Math.max(2, Math.round((height / width) * scoreW))
    scoreCanvas.width = scoreW
    scoreCanvas.height = scoreH
    const scoreCtx = scoreCanvas.getContext('2d', {
      willReadFrequently: true,
    })
    if (ctx === null || scoreCtx === null) {
      throw new Error('Canvas is unavailable.')
    }

    const window = Math.min(windowSeconds, duration)
    // Land slightly inside the end — seeking exactly to `duration` can
    // clamp to an empty frame in some decoders.
    const end = Math.max(0, duration - 0.02)
    const start = Math.max(0, end - window)
    const step = count > 1 ? (end - start) / (count - 1) : 0

    const frames: GrabbedFrame[] = []
    for (let i = 0; i < count; i++) {
      const time = start + step * i
      await seekTo(video, time)
      ctx.drawImage(video, 0, 0, width, height)
      scoreCtx.drawImage(video, 0, 0, scoreW, scoreH)
      const sharpness = sharpnessScore(
        scoreCtx.getImageData(0, 0, scoreW, scoreH),
      )
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })
      if (blob === null) continue
      frames.push({ blob, time, sharpness })
    }
    if (frames.length === 0) {
      throw new Error('No frames could be read from the clip.')
    }
    return frames
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

/** Index of the sharpest frame — the UI's suggested pick. */
export function sharpestIndex(frames: GrabbedFrame[]): number {
  let best = 0
  for (let i = 1; i < frames.length; i++) {
    if (frames[i]!.sharpness > frames[best]!.sharpness) best = i
  }
  return best
}
