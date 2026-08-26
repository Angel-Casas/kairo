import { describe, expect, it } from 'vitest'
import { sharpestIndex, type GrabbedFrame } from './frameGrab'

const frame = (sharpness: number): GrabbedFrame => ({
  blob: new Blob(),
  time: 0,
  sharpness,
})

describe('sharpestIndex', () => {
  it('picks the frame with the highest gradient energy', () => {
    expect(sharpestIndex([frame(0.1), frame(0.9), frame(0.4)])).toBe(1)
  })

  it('prefers the earliest on ties and handles a single frame', () => {
    expect(sharpestIndex([frame(0.5), frame(0.5)])).toBe(0)
    expect(sharpestIndex([frame(0)])).toBe(0)
  })
})
