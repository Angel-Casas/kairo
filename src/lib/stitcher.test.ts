import { describe, expect, it } from 'vitest'
import { buildConcatList, StitchError, stitchClips } from './stitcher'

describe('buildConcatList', () => {
  it('lists clip files in order for the concat demuxer', () => {
    expect(buildConcatList(3)).toBe(
      "file 'clip-0.mp4'\nfile 'clip-1.mp4'\nfile 'clip-2.mp4'",
    )
  })
})

describe('stitchClips', () => {
  it('rejects an empty clip list before touching the engine', async () => {
    await expect(stitchClips([], () => undefined)).rejects.toThrow(StitchError)
  })
})
