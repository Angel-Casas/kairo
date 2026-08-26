import { describe, expect, it } from 'vitest'
import {
  achievableFrameDurations,
  narrationCutoffWarning,
  pickClipDuration,
  planFrames,
} from './clipDuration'

describe('pickClipDuration (Slice 15.11)', () => {
  it('picks the smallest duration that covers the narration', () => {
    expect(pickClipDuration(['5', '8', '10'], 6.4, '5')).toBe('8')
    expect(pickClipDuration(['10', '5', '8'], 6.4, '5')).toBe('8') // unsorted input
    expect(pickClipDuration(['5', '8'], 4.9, '8')).toBe('5')
    expect(pickClipDuration(['5', '8'], 5.0, '8')).toBe('5') // exact fit counts
  })

  it('caps at the longest option when nothing covers the narration', () => {
    expect(pickClipDuration(['5', '8'], 11.2, '5')).toBe('8')
  })

  it('falls back to the selected duration when it cannot know better', () => {
    expect(pickClipDuration(['5', '8'], null, '5')).toBe('5') // unmeasurable
    expect(pickClipDuration([], 7, '6')).toBe('6') // model lists no options
    expect(pickClipDuration(['fast', ''], 7, '6')).toBe('6') // junk options
  })
})

const WAN_21 = {
  minFrames: 81,
  maxFrames: 100,
  defaultFrames: 81,
  minFps: 5,
  maxFps: 24,
  defaultFps: 16,
}

describe('planFrames (Slice 15.14)', () => {
  it('reaches the target with the FEWEST frames (cheapest)', () => {
    // Angel's case: 8 seconds on Wan 2.1.
    expect(planFrames(WAN_21, 8)).toEqual({ frames: 81, fps: 10, seconds: 8.1 })
    const five = planFrames(WAN_21, 5)
    expect(five.frames).toBe(81) // never pays the +25% frame surcharge
    expect(five.seconds).toBeCloseTo(5.06, 1)
  })

  it('clamps honestly at the achievable edges', () => {
    const short = planFrames(WAN_21, 2) // shortest possible: 81 @ 24fps
    expect(short.fps).toBe(24)
    expect(short.seconds).toBeCloseTo(3.375, 3)
    const long = planFrames(WAN_21, 30) // longest possible: 100 @ 5fps
    expect(long).toEqual({ frames: 100, fps: 5, seconds: 20 })
  })
})

describe('achievableFrameDurations', () => {
  it('offers only second-targets the model can produce', () => {
    expect(achievableFrameDurations(WAN_21)).toEqual([
      '4',
      '5',
      '6',
      '8',
      '10',
      '12',
      '15',
      '20',
    ])
  })
})

describe('narrationCutoffWarning (22.16)', () => {
  it('warns when the clip is shorter than the narration', () => {
    const warning = narrationCutoffWarning(8.2, 5)
    expect(warning).toContain('8.2s')
    expect(warning).toContain('5s')
    expect(warning).toContain('cut off')
  })

  it('stays quiet when the clip covers the narration (with grace)', () => {
    expect(narrationCutoffWarning(4.9, 5)).toBeNull()
    expect(narrationCutoffWarning(5.2, 5)).toBeNull()
    expect(narrationCutoffWarning(5.26, 5)).not.toBeNull()
  })

  it('stays quiet when either length is unknown', () => {
    expect(narrationCutoffWarning(null, 5)).toBeNull()
    expect(narrationCutoffWarning(8, null)).toBeNull()
    expect(narrationCutoffWarning(8, Number.NaN)).toBeNull()
  })
})
