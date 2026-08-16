import { describe, expect, it } from 'vitest'
import {
  applyJobEvent,
  InvalidTransitionError,
  isActiveJobState,
} from './transitions'
import type { GenerationJob, JobState } from './types'

const NOW = '2026-08-16T12:00:00.000Z'
const now = () => NOW

function job(state: JobState): GenerationJob {
  return {
    id: 'job-1',
    projectId: 'p-1',
    sceneId: 's-1',
    kind: 'video',
    model: 'some-model',
    state,
    remoteJobId: state === 'queued' ? null : 'remote-1',
    error: null,
    estimatedUsd: 0.1,
    prompt: null,
    submittedCostUsd: null,
    createdAt: '2026-08-16T11:00:00.000Z',
    updatedAt: '2026-08-16T11:00:00.000Z',
  }
}

describe('applyJobEvent — happy paths', () => {
  it('walks the async video path: queued → submitted → polling → succeeded', () => {
    let j = job('queued')
    j = applyJobEvent(j, { type: 'submit', remoteJobId: 'r-9' }, now)
    expect(j.state).toBe('submitted')
    expect(j.remoteJobId).toBe('r-9')
    j = applyJobEvent(j, { type: 'poll' }, now)
    expect(j.state).toBe('polling')
    j = applyJobEvent(j, { type: 'poll' }, now)
    expect(j.state).toBe('polling')
    j = applyJobEvent(j, { type: 'succeed' }, now)
    expect(j.state).toBe('succeeded')
    expect(j.updatedAt).toBe(NOW)
  })

  it('walks the sync path: queued → submitted → succeeded (e.g. images)', () => {
    let j = job('queued')
    j = applyJobEvent(j, { type: 'submit', remoteJobId: null }, now)
    j = applyJobEvent(j, { type: 'succeed' }, now)
    expect(j.state).toBe('succeeded')
  })

  it('records the error on failure', () => {
    const j = applyJobEvent(
      job('polling'),
      { type: 'fail', error: 'boom' },
      now,
    )
    expect(j.state).toBe('failed')
    expect(j.error).toBe('boom')
  })

  it('retry resets a failed job to queued and clears error/remote id', () => {
    const failed = { ...job('failed'), error: 'boom' }
    const j = applyJobEvent(failed, { type: 'retry' }, now)
    expect(j.state).toBe('queued')
    expect(j.error).toBeNull()
    expect(j.remoteJobId).toBeNull()
  })

  it('does not mutate the input job', () => {
    const original = job('queued')
    applyJobEvent(original, { type: 'submit', remoteJobId: 'r' }, now)
    expect(original.state).toBe('queued')
    expect(original.remoteJobId).toBeNull()
  })
})

describe('applyJobEvent — forbidden transitions', () => {
  it('succeeded is terminal', () => {
    for (const type of [
      'submit',
      'poll',
      'succeed',
      'fail',
      'retry',
    ] as const) {
      const event =
        type === 'submit'
          ? { type, remoteJobId: null }
          : type === 'fail'
            ? { type, error: 'x' }
            : { type }
      expect(() => applyJobEvent(job('succeeded'), event, now)).toThrow(
        InvalidTransitionError,
      )
    }
  })

  it('failed only allows retry', () => {
    expect(() => applyJobEvent(job('failed'), { type: 'poll' }, now)).toThrow(
      InvalidTransitionError,
    )
    expect(() =>
      applyJobEvent(job('failed'), { type: 'succeed' }, now),
    ).toThrow(InvalidTransitionError)
  })

  it('cannot poll or succeed before submitting', () => {
    expect(() => applyJobEvent(job('queued'), { type: 'poll' }, now)).toThrow(
      InvalidTransitionError,
    )
    expect(() =>
      applyJobEvent(job('queued'), { type: 'succeed' }, now),
    ).toThrow(InvalidTransitionError)
  })

  it('cannot retry a job that has not failed', () => {
    expect(() => applyJobEvent(job('polling'), { type: 'retry' }, now)).toThrow(
      InvalidTransitionError,
    )
  })
})

describe('isActiveJobState', () => {
  it('marks queued/submitted/polling active, terminal states not', () => {
    expect(isActiveJobState('queued')).toBe(true)
    expect(isActiveJobState('submitted')).toBe(true)
    expect(isActiveJobState('polling')).toBe(true)
    expect(isActiveJobState('succeeded')).toBe(false)
    expect(isActiveJobState('failed')).toBe(false)
  })
})
