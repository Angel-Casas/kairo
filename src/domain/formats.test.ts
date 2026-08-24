import { describe, expect, it } from 'vitest'
import { getFormatSpec, VIDEO_FORMATS } from './formats'
import {
  createProject,
  normalizeProject,
  PROJECT_FORMAT_IDS,
  type Project,
} from './types'

describe('video formats', () => {
  it('covers every project format id with a spec', () => {
    for (const id of PROJECT_FORMAT_IDS) {
      expect(getFormatSpec(id).id).toBe(id)
    }
    expect(VIDEO_FORMATS).toHaveLength(PROJECT_FORMAT_IDS.length)
  })

  it('falls back to vertical for undefined', () => {
    expect(getFormatSpec(undefined).id).toBe('vertical')
  })

  it('keeps ratio, aspectParam, and cssAspect consistent', () => {
    for (const spec of VIDEO_FORMATS) {
      const [w, h] = spec.aspectParam.split(':').map(Number)
      expect(spec.ratio).toBeCloseTo((w ?? 1) / (h ?? 1), 5)
      expect(spec.cssAspect.replace(/\s/g, '')).toBe(
        `${String(w)}/${String(h)}`,
      )
    }
  })
})

describe('project format persistence', () => {
  it('new projects default to vertical', () => {
    const p = createProject('T', () => '2026-01-01T00:00:00.000Z')
    expect(p.format).toBe('vertical')
  })

  it('createProject accepts a chosen format', () => {
    const p = createProject('T', () => '2026-01-01T00:00:00.000Z', 'widescreen')
    expect(p.format).toBe('widescreen')
  })

  it("heals the legacy 'short' placeholder to vertical on normalize", () => {
    const p = createProject('T', () => '2026-01-01T00:00:00.000Z')
    const legacy = { ...p, format: 'short' } as unknown as Project
    expect(normalizeProject(legacy).format).toBe('vertical')
  })

  it('heals a missing format to vertical on normalize', () => {
    const p = createProject('T', () => '2026-01-01T00:00:00.000Z')
    const { format: _dropped, ...rest } = p
    expect(normalizeProject(rest as Project).format).toBe('vertical')
  })

  it('keeps a valid stored format on normalize', () => {
    const p = createProject('T', () => '2026-01-01T00:00:00.000Z', 'cinematic')
    expect(normalizeProject(p).format).toBe('cinematic')
  })
})
