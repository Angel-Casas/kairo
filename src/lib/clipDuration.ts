/**
 * Pick a clip duration that covers a scene's narration (Slice 15.11,
 * Angel's catch: animate-all used ONE duration for every scene, so long
 * narrations got clipped and users had to redo scenes by hand).
 *
 * Rule: the SMALLEST duration the model offers that is at least as long
 * as the narration; the model's longest when nothing covers it (the
 * mismatch warning in the clips panel still tells the truth then); the
 * caller's selected duration when the narration length is unknown or the
 * model lists no duration options.
 */
export function pickClipDuration(
  options: string[],
  narrationSeconds: number | null,
  fallback: string,
): string {
  if (narrationSeconds === null) return fallback
  const numeric = options
    .map((option) => ({ option, seconds: Number(option) }))
    .filter(({ seconds }) => Number.isFinite(seconds) && seconds > 0)
    .sort((a, b) => a.seconds - b.seconds)
  if (numeric.length === 0) return fallback
  const covering = numeric.find(
    ({ seconds }) => seconds + 1e-6 >= narrationSeconds,
  )
  return (covering ?? numeric[numeric.length - 1] ?? { option: fallback })
    .option
}

/**
 * Frame-based duration control (Slice 15.14). Some models (Wan 2.1, Wan
 * 2.2 5b) take no `duration` at all — they take `num_frames` and
 * `frames_per_second`, and silently ignore a duration ask (Angel's 8s
 * request came back as the 81-frame/16fps default ≈ 5.1s). Kairo keeps
 * ALL its UI in seconds and translates at the API boundary.
 */
export interface FrameControl {
  minFrames: number
  maxFrames: number
  defaultFrames: number
  minFps: number
  maxFps: number
  defaultFps: number
}

export interface FramePlan {
  frames: number
  fps: number
  /** The clip length these settings actually produce. */
  seconds: number
}

/**
 * Translate a target length into frames + fps. Strategy: FEWEST frames
 * that reach the target (frames drive cost — Wan 2.1 charges +25% above
 * 81), at whatever fps hits the length; fps clamps to the model's range,
 * so very short targets cap at max fps and very long ones at min fps
 * with max frames (the honest nearest achievable clip).
 */
export function planFrames(
  control: FrameControl,
  targetSeconds: number,
): FramePlan {
  const fps = Math.min(
    control.maxFps,
    Math.max(control.minFps, Math.round(control.minFrames / targetSeconds)),
  )
  const frames = Math.min(
    control.maxFrames,
    Math.max(control.minFrames, Math.round(targetSeconds * fps)),
  )
  return { frames, fps, seconds: frames / fps }
}

const TARGET_CANDIDATES = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30]

/**
 * The second-targets a frame-based model can actually produce, as duration
 * strings — so the duration picker, narration auto-fit and the batch
 * overlay work unchanged, in seconds, for these models too.
 */
export function achievableFrameDurations(control: FrameControl): string[] {
  const min = control.minFrames / control.maxFps
  const max = control.maxFrames / control.minFps
  const targets = TARGET_CANDIDATES.filter((t) => t >= min && t <= max)
  if (targets.length > 0) return targets.map(String)
  // Degenerate range — offer the default settings' length.
  return [String(Math.round(control.defaultFrames / control.defaultFps))]
}
