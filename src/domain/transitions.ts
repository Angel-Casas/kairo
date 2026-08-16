import type { GenerationJob, JobState } from './types'

export type JobEvent =
  | { type: 'submit'; remoteJobId: string | null }
  | { type: 'poll' }
  | { type: 'succeed' }
  | { type: 'fail'; error: string }
  | { type: 'retry' }

export class InvalidTransitionError extends Error {
  constructor(state: JobState, event: JobEvent['type']) {
    super(`Invalid job transition: cannot '${event}' from state '${state}'`)
    this.name = 'InvalidTransitionError'
  }
}

const TRANSITIONS: Record<
  JobState,
  Partial<Record<JobEvent['type'], JobState>>
> = {
  queued: { submit: 'submitted', fail: 'failed' },
  submitted: { poll: 'polling', succeed: 'succeeded', fail: 'failed' },
  polling: { poll: 'polling', succeed: 'succeeded', fail: 'failed' },
  succeeded: {},
  failed: { retry: 'queued' },
}

export const ACTIVE_JOB_STATES: readonly JobState[] = [
  'queued',
  'submitted',
  'polling',
]

export function isActiveJobState(state: JobState): boolean {
  return ACTIVE_JOB_STATES.includes(state)
}

/**
 * Apply an event to a job, returning a NEW job object (input is not mutated).
 * Throws InvalidTransitionError for transitions the state machine forbids.
 */
export function applyJobEvent(
  job: GenerationJob,
  event: JobEvent,
  now: () => string,
): GenerationJob {
  const next = TRANSITIONS[job.state][event.type]
  if (next === undefined) {
    throw new InvalidTransitionError(job.state, event.type)
  }
  const updated: GenerationJob = { ...job, state: next, updatedAt: now() }
  switch (event.type) {
    case 'submit':
      updated.remoteJobId = event.remoteJobId
      break
    case 'fail':
      updated.error = event.error
      break
    case 'retry':
      updated.error = null
      updated.remoteJobId = null
      break
    case 'poll':
    case 'succeed':
      break
  }
  return updated
}
