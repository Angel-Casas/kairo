import { applyJobEvent } from '../domain/transitions'
import type { GenerationJob, GenerationKind } from '../domain/types'
import { getRepository } from './repo'

const nowIso = () => new Date().toISOString()

export type JobOutcome<T> = { ok: true; value: T } | { ok: false; error: Error }

/**
 * Run one generation through the persisted job lifecycle shared by every
 * stage: queued → submitted → (run) → succeeded | failed. Each transition is
 * persisted so interrupted work is visible and (for async kinds) resumable.
 */
export async function withGenerationJob<T>(params: {
  projectId: string
  sceneId: string | null
  kind: GenerationKind
  model: string
  estimatedUsd: number | null
  run: () => Promise<T>
}): Promise<JobOutcome<T>> {
  const repo = await getRepository()
  let job: GenerationJob = {
    id: crypto.randomUUID(),
    projectId: params.projectId,
    sceneId: params.sceneId,
    kind: params.kind,
    model: params.model,
    state: 'queued',
    remoteJobId: null,
    error: null,
    estimatedUsd: params.estimatedUsd,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await repo.putJob(job)
  job = applyJobEvent(job, { type: 'submit', remoteJobId: null }, nowIso)
  await repo.putJob(job)

  try {
    const value = await params.run()
    job = applyJobEvent(job, { type: 'succeed' }, nowIso)
    await repo.putJob(job)
    return { ok: true, value }
  } catch (error) {
    const normalized =
      error instanceof Error ? error : new Error('Unknown error')
    job = applyJobEvent(
      job,
      { type: 'fail', error: normalized.message },
      nowIso,
    )
    await repo.putJob(job)
    return { ok: false, error: normalized }
  }
}
