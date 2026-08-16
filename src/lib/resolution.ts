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
 * Pick the best resolution for a vertical 9:16 short from a model's list:
 * the portrait resolution closest to 9:16, else square, else the first
 * listed, else null (caller falls back to the aspect_ratio parameter).
 */
export function pickPortraitResolution(model: ImageModel): string | null {
  const candidates = model.resolutions
    .map((r) => ({ raw: r, dims: parse(r) }))
    .filter((c): c is { raw: string; dims: { w: number; h: number } } =>
      Boolean(c.dims),
    )
  if (candidates.length === 0) return model.resolutions[0] ?? null

  const target = 9 / 16
  const portrait = candidates.filter((c) => c.dims.h > c.dims.w)
  if (portrait.length > 0) {
    portrait.sort(
      (a, b) =>
        Math.abs(a.dims.w / a.dims.h - target) -
        Math.abs(b.dims.w / b.dims.h - target),
    )
    return portrait[0]?.raw ?? null
  }
  const square = candidates.find((c) => c.dims.w === c.dims.h)
  return square?.raw ?? candidates[0]?.raw ?? null
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
