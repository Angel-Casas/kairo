/**
 * Kairo domain model.
 *
 * Principles encoded here (see CLAUDE.md):
 * - Never lose paid assets: versions are append-only arrays, never overwritten.
 * - Everything is resumable: in-flight generations are persisted GenerationJobs.
 * - Cost transparency: every generation is recorded in the project's cost log.
 */

export type ProjectFormat = 'short'

export type AssetKind = 'image' | 'video'

export type GenerationKind = 'text' | 'image' | 'video'

/** One generated asset (an image or a video clip). Append-only; never mutated. */
export interface AssetVersion {
  id: string
  kind: AssetKind
  /** NanoGPT model identifier used to generate this version. */
  model: string
  prompt: string
  /** Actual cost in USD, when known. */
  costUsd: number | null
  /** Path of the binary in the BlobStore (OPFS), e.g. `<projectId>/<versionId>`. */
  blobPath: string
  mimeType: string
  createdAt: string
}

export interface Scene {
  id: string
  /** 0-based position in the video. */
  order: number
  /** The part of the script this scene covers. */
  textExcerpt: string
  /** Visual description used as the image prompt basis. */
  visualDescription: string
  imageVersions: AssetVersion[]
  activeImageVersionId: string | null
  videoVersions: AssetVersion[]
  activeVideoVersionId: string | null
}

/** Append-only record of money spent (or about to be spent) on generations. */
export interface CostLogEntry {
  id: string
  at: string
  kind: GenerationKind
  model: string
  estimatedUsd: number | null
  actualUsd: number | null
  note: string
}

export const PROJECT_SCHEMA_VERSION = 1

export interface Project {
  id: string
  title: string
  format: ProjectFormat
  script: {
    text: string
    /** Locked scripts are the basis for scene breakdown; editing unlocks downstream stages. */
    locked: boolean
  }
  /** Free-form style guidance carried into every image prompt for consistency. */
  styleNotes: string
  scenes: Scene[]
  costLog: CostLogEntry[]
  createdAt: string
  updatedAt: string
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
}

/**
 * Lifecycle of one generation request.
 *
 *   queued → submitted → polling → succeeded
 *        \        \          \→ failed
 *         \        \→ succeeded | failed
 *          \→ failed            failed → queued (retry)
 *
 * Jobs are persisted so interrupted generations (tab closed mid-poll) can be
 * found and resumed on next launch.
 */
export type JobState =
  'queued' | 'submitted' | 'polling' | 'succeeded' | 'failed'

export interface GenerationJob {
  id: string
  projectId: string
  /** Null for project-level jobs (e.g. script generation). */
  sceneId: string | null
  kind: GenerationKind
  model: string
  state: JobState
  /** Provider-side job id, once submitted (video jobs are async on NanoGPT). */
  remoteJobId: string | null
  error: string | null
  estimatedUsd: number | null
  createdAt: string
  updatedAt: string
}

export function createProject(title: string, now: () => string): Project {
  const at = now()
  return {
    id: crypto.randomUUID(),
    title,
    format: 'short',
    script: { text: '', locked: false },
    styleNotes: '',
    scenes: [],
    costLog: [],
    createdAt: at,
    updatedAt: at,
    schemaVersion: PROJECT_SCHEMA_VERSION,
  }
}
