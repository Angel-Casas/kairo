import type { ImageModel } from '../api/nanogpt'

/**
 * Resolution helpers. NanoGPT models list resolutions like "1024x1024" while
 * per-image pricing keys sometimes use "1024*1024" — both separators are
 * handled everywhere.
 */

function parse(resolution: string): { w: number; h: number } | null {
  const match = /^(\d+)\s*[x*×]\s*(\d+)$/i.exec(resolution.trim())
  if (match === null) return null
  const w = Number(match[1])
  const h = Number(match[2])
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null
  }
  return { w, h }
}

/**
 * Pick the best resolution for the project's format from a model's list
 * (Slice 18): the resolution whose w/h ratio is closest to the target
 * ratio — same-orientation candidates first, so a 16:9 project on a model
 * offering only portrait + square sizes lands on square, never portrait.
 * Falls back to the first listed size, else null (caller then relies on
 * the aspect_ratio parameter instead).
 */
export function pickResolutionForRatio(
  model: ImageModel,
  targetRatio: number,
): string | null {
  const candidates = model.resolutions
    .map((r) => ({ raw: r, dims: parse(r) }))
    .filter((c): c is { raw: string; dims: { w: number; h: number } } =>
      Boolean(c.dims),
    )
  if (candidates.length === 0) return model.resolutions[0] ?? null

  const orientation = (ratio: number): 'portrait' | 'square' | 'landscape' =>
    ratio < 1 ? 'portrait' : ratio > 1 ? 'landscape' : 'square'
  const target = orientation(targetRatio)
  const byCloseness = (
    list: { raw: string; dims: { w: number; h: number } }[],
  ) =>
    [...list].sort(
      (a, b) =>
        Math.abs(a.dims.w / a.dims.h - targetRatio) -
        Math.abs(b.dims.w / b.dims.h - targetRatio),
    )

  const sameOrientation = candidates.filter(
    (c) => orientation(c.dims.w / c.dims.h) === target,
  )
  if (sameOrientation.length > 0) {
    return byCloseness(sameOrientation)[0]?.raw ?? null
  }
  const square = candidates.find((c) => c.dims.w === c.dims.h)
  if (square !== undefined && target !== 'square') return square.raw
  return byCloseness(candidates)[0]?.raw ?? null
}

/**
 * Rank a video resolution tier for cheapest-first sorting: "480p" → 480,
 * "2k" → 2000, "4k" → 4000, "1792x1024" → larger dimension. Unparseable
 * tiers rank last (assumed expensive/unknown).
 */
export function videoResolutionRank(resolution: string): number {
  const trimmed = resolution.trim().toLowerCase()
  const pMatch = /^(\d+)p$/.exec(trimmed)
  if (pMatch !== null) return Number(pMatch[1])
  const kMatch = /^(\d+(?:\.\d+)?)k$/.exec(trimmed)
  if (kMatch !== null) return Number(kMatch[1]) * 1000
  const dims = parse(trimmed)
  if (dims !== null) return Math.max(dims.w, dims.h)
  return Number.MAX_SAFE_INTEGER
}

/** Sort video resolutions cheapest (lowest) first. */
export function sortVideoResolutionsCheapestFirst(
  resolutions: string[],
): string[] {
  return [...resolutions].sort(
    (a, b) => videoResolutionRank(a) - videoResolutionRank(b),
  )
}

/** Per-image USD price for a resolution, tolerating x/* separator drift. */
export function getPerImagePriceUsd(
  model: ImageModel,
  resolution: string | null,
): number | null {
  const prices = model.perImageUsd
  const keys = Object.keys(prices)
  if (keys.length === 0) return null
  if (resolution !== null) {
    const variants = [
      resolution,
      resolution.replace('x', '*'),
      resolution.replace('*', 'x'),
    ]
    for (const variant of variants) {
      const price = prices[variant]
      if (price !== undefined) return price
    }
  }
  // Single flat price regardless of resolution.
  if (keys.length === 1) {
    const only = keys[0]
    return only === undefined ? null : (prices[only] ?? null)
  }
  return null
}
