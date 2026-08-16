import { describe, expect, it } from 'vitest'
import type { ImageModel } from '../api/nanogpt'
import { getPerImagePriceUsd, pickPortraitResolution } from './resolution'

function model(overrides: Partial<ImageModel>): ImageModel {
  return {
    id: 'img',
    name: 'Img',
    description: '',
    perImageUsd: {},
    resolutions: [],
    supportsImageToImage: false,
    ...overrides,
  }
}

describe('pickPortraitResolution', () => {
  it('prefers the portrait resolution closest to 9:16', () => {
    const m = model({
      resolutions: ['1024x1024', '768x1344', '1024x1536', '1344x768'],
    })
    // 768x1344 = 0.571 ratio ≈ 9:16 (0.5625); 1024x1536 = 0.667.
    expect(pickPortraitResolution(m)).toBe('768x1344')
  })

  it('falls back to square when no portrait exists', () => {
    const m = model({ resolutions: ['1344x768', '1024x1024'] })
    expect(pickPortraitResolution(m)).toBe('1024x1024')
  })

  it('falls back to the first listed when nothing parses', () => {
    const m = model({ resolutions: ['auto'] })
    expect(pickPortraitResolution(m)).toBe('auto')
  })

  it('returns null for models without listed resolutions', () => {
    expect(pickPortraitResolution(model({}))).toBeNull()
  })

  it('tolerates the * separator', () => {
    const m = model({ resolutions: ['1024*1792', '1024*1024'] })
    expect(pickPortraitResolution(m)).toBe('1024*1792')
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
