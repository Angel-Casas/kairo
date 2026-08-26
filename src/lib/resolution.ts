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
 * Pixel size OR ratio label → proportions. Grok Imagine lists "9:16" as
 * a resolution; for ratio math that is just w=9, h=16 (22.6 — Angel's
 * vertical project defaulted to the FIRST listed ratio because the
 * picker only understood pixel sizes).
 */
function parseProportions(resolution: string): { w: number; h: number } | null {
  const dims = parse(resolution)
  if (dims !== null) return dims
  const ratio = /^(\d+)\s*:\s*(\d+)$/.exec(resolution.trim())
  if (ratio === null) return null
  const w = Number(ratio[1])
  const h = Number(ratio[2])
  if (w <= 0 || h <= 0) return null
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
    .map((r) => ({ raw: r, dims: parseProportions(r) }))
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

/**
 * Human-friendly resolution label (22.5, Angel's request, modeled on
 * NanoGPT's own picker): pixel sizes gain their aspect ratio and
 * orientation — "1152x2048" → "1152x2048 — 9:16 (Portrait)" — because
 * ratios are easier to reason about than pixel counts. Bare ratio
 * labels ("9:16") gain just the orientation word; tiers like "480p"
 * and unparseable values pass through unchanged. A "≈" marks ratios
 * that only approximate a friendly one (768x1344 is 4:7, shown as
 * "≈9:16" — the nearest ratio a human actually thinks in).
 */
const FRIENDLY_RATIOS: [number, number][] = [
  [1, 1],
  [4, 3],
  [3, 4],
  [3, 2],
  [2, 3],
  [16, 9],
  [9, 16],
  [16, 10],
  [10, 16],
  [5, 4],
  [4, 5],
  [21, 9],
  [9, 21],
  [2, 1],
  [1, 2],
]

function orientationWord(w: number, h: number): string {
  return w === h ? 'Square' : w < h ? 'Portrait' : 'Landscape'
}

export function resolutionLabel(value: string): string {
  const trimmed = value.trim()
  const ratioMatch = /^(\d+)\s*:\s*(\d+)$/.exec(trimmed)
  if (ratioMatch !== null) {
    const w = Number(ratioMatch[1])
    const h = Number(ratioMatch[2])
    if (w > 0 && h > 0) return `${trimmed} (${orientationWord(w, h)})`
  }
  const dims = parse(trimmed)
  if (dims === null) return trimmed
  const ratio = dims.w / dims.h
  let best: { label: string; err: number } | null = null
  for (const [rw, rh] of FRIENDLY_RATIOS) {
    const err = Math.abs(ratio - rw / rh) / (rw / rh)
    if (best === null || err < best.err) {
      best = { label: `${String(rw)}:${String(rh)}`, err }
    }
  }
  const orientation = orientationWord(dims.w, dims.h)
  if (best !== null && best.err < 0.035) {
    const approx = best.err > 0.001 ? '≈' : ''
    return `${trimmed} — ${approx}${best.label} (${orientation})`
  }
  return `${trimmed} — ${orientation}`
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
