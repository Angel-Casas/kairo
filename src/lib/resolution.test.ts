import { describe, expect, it } from 'vitest'
import type { ImageModel } from '../api/nanogpt'
import { getPerImagePriceUsd, pickResolutionForRatio } from './resolution'

function model(overrides: Partial<ImageModel>): ImageModel {
  return {
    id: 'img',
    name: 'Img',
    description: '',
    perImageUsd: {},
    resolutions: [],
    supportsImageToImage: false,
    releasedAt: null,
    ...overrides,
  }
}

describe('pickResolutionForRatio', () => {
  const VERTICAL = 9 / 16
  const WIDESCREEN = 16 / 9

  it('prefers the portrait resolution closest to 9:16 for vertical', () => {
    const m = model({
      resolutions: ['1024x1024', '768x1344', '1024x1536', '1344x768'],
    })
    // 768x1344 = 0.571 ratio ≈ 9:16 (0.5625); 1024x1536 = 0.667.
    expect(pickResolutionForRatio(m, VERTICAL)).toBe('768x1344')
  })

  it('prefers the landscape resolution closest to 16:9 for widescreen', () => {
    const m = model({
      resolutions: ['1024x1024', '768x1344', '1344x768', '1536x1024'],
    })
    // 1344x768 = 1.75 ≈ 16:9 (1.778); 1536x1024 = 1.5.
    expect(pickResolutionForRatio(m, WIDESCREEN)).toBe('1344x768')
  })

  it('picks the exact square for a 1:1 project', () => {
    const m = model({ resolutions: ['768x1344', '1024x1024', '1344x768'] })
    expect(pickResolutionForRatio(m, 1)).toBe('1024x1024')
  })

  it('falls back to square when no same-orientation size exists', () => {
    const m = model({ resolutions: ['1344x768', '1024x1024'] })
    expect(pickResolutionForRatio(m, VERTICAL)).toBe('1024x1024')
    const m2 = model({ resolutions: ['768x1344', '1024x1024'] })
    expect(pickResolutionForRatio(m2, WIDESCREEN)).toBe('1024x1024')
  })

  it('falls back to the closest ratio when neither orientation nor square exists', () => {
    const m = model({ resolutions: ['768x1344'] })
    expect(pickResolutionForRatio(m, WIDESCREEN)).toBe('768x1344')
  })

  it('falls back to the first listed when nothing parses', () => {
    const m = model({ resolutions: ['auto'] })
    expect(pickResolutionForRatio(m, VERTICAL)).toBe('auto')
  })

  it('returns null for models without listed resolutions', () => {
    expect(pickResolutionForRatio(model({}), VERTICAL)).toBeNull()
  })

  it('tolerates the * separator', () => {
    const m = model({ resolutions: ['1024*1792', '1024*1024'] })
    expect(pickResolutionForRatio(m, VERTICAL)).toBe('1024*1792')
  })

  it('understands ratio labels like "9:16" (22.6 — Grok Imagine lists ratios)', () => {
    const m = model({ resolutions: ['1:1', '16:9', '9:16', '4:3'] })
    expect(pickResolutionForRatio(m, VERTICAL)).toBe('9:16')
    expect(pickResolutionForRatio(m, 16 / 9)).toBe('16:9')
    expect(pickResolutionForRatio(m, 1)).toBe('1:1')
  })
})

describe('video resolution ranking', () => {
  it('sorts tiers cheapest first across formats', async () => {
    const { sortVideoResolutionsCheapestFirst } = await import('./resolution')
    expect(
      sortVideoResolutionsCheapestFirst(['4k', '1080p', '480p', '2k', '720p']),
    ).toEqual(['480p', '720p', '1080p', '2k', '4k'])
  })

  it('ranks dimension strings by their larger side and unknowns last', async () => {
    const { sortVideoResolutionsCheapestFirst } = await import('./resolution')
    expect(
      sortVideoResolutionsCheapestFirst(['auto', '1792x1024', '480p']),
    ).toEqual(['480p', '1792x1024', 'auto'])
  })
})

describe('resolutionLabel (22.5 — ratios humans think in)', () => {
  it('appends the exact ratio and orientation to pixel sizes', async () => {
    const { resolutionLabel } = await import('./resolution')
    expect(resolutionLabel('1152x2048')).toBe('1152x2048 — 9:16 (Portrait)')
    expect(resolutionLabel('1024x768')).toBe('1024x768 — 4:3 (Landscape)')
    expect(resolutionLabel('1024x1024')).toBe('1024x1024 — 1:1 (Square)')
    expect(resolutionLabel('1024*1792')).toBe('1024*1792 — ≈9:16 (Portrait)')
  })

  it('marks approximate ratios with ≈', async () => {
    const { resolutionLabel } = await import('./resolution')
    // 768x1344 is exactly 4:7 — close to, but not, 9:16.
    expect(resolutionLabel('768x1344')).toBe('768x1344 — ≈9:16 (Portrait)')
  })

  it('adds only the orientation to bare ratio labels', async () => {
    const { resolutionLabel } = await import('./resolution')
    expect(resolutionLabel('9:16')).toBe('9:16 (Portrait)')
    expect(resolutionLabel('16:9')).toBe('16:9 (Landscape)')
    expect(resolutionLabel('1:1')).toBe('1:1 (Square)')
  })

  it('passes tiers and unparseable values through unchanged', async () => {
    const { resolutionLabel } = await import('./resolution')
    expect(resolutionLabel('480p')).toBe('480p')
    expect(resolutionLabel('auto')).toBe('auto')
  })
})

describe('getPerImagePriceUsd', () => {
  it('looks up the resolution price with separator drift', () => {
    const m = model({ perImageUsd: { '1024*1792': 0.02, '1024*1024': 0.01 } })
    expect(getPerImagePriceUsd(m, '1024x1792')).toBe(0.02)
    expect(getPerImagePriceUsd(m, '1024*1024')).toBe(0.01)
  })

  it('uses a single flat price when only one exists', () => {
    const m = model({ perImageUsd: { default: 0.03 } })
    expect(getPerImagePriceUsd(m, '512x512')).toBe(0.03)
    expect(getPerImagePriceUsd(m, null)).toBe(0.03)
  })

  it('returns null when pricing is absent or ambiguous', () => {
    expect(getPerImagePriceUsd(model({}), '1024x1024')).toBeNull()
    const multi = model({ perImageUsd: { a: 0.01, b: 0.02 } })
    expect(getPerImagePriceUsd(multi, 'c')).toBeNull()
  })
})
