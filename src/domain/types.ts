/**
 * Kairo domain model.
 *
 * Principles encoded here (see CLAUDE.md):
 * - Never lose paid assets: versions are append-only arrays, never overwritten.
 * - Everything is resumable: in-flight generations are persisted GenerationJobs.
 * - Cost transparency: every generation is recorded in the project's cost log.
 */

export type ProjectFormat = 'short'

export type AssetKind = 'image' | 'video' | 'audio'

export type GenerationKind = 'text' | 'image' | 'video' | 'audio'

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
  /** Ids of project references this scene uses (Slice 10). */
  referenceIds: string[]
  imageVersions: AssetVersion[]
  activeImageVersionId: string | null
  videoVersions: AssetVersion[]
  activeVideoVersionId: string | null
  /** Narration takes (Slice 15): TTS of the scene's script excerpt. */
  audioVersions: AssetVersion[]
  activeAudioVersionId: string | null
}

export type ReferenceKind = 'character' | 'location' | 'style'

/**
 * A project-level Reference (Slice 10): a character, location, or art style
 * that scenes opt into for cross-scene consistency. The descriptor is
 * injected VERBATIM into tagged scenes' image prompts — never shortened; a
 * variant (older, injured, repainted…) is a separate reference. The optional
 * reference image (append-only versions, like scenes) is attached to
 * generation requests for image-to-image capable models.
 */
export interface ReferenceAsset {
  id: string
  kind: ReferenceKind
  name: string
  /** Exhaustive visual description, injected verbatim into image prompts. */
  descriptor: string
  imageVersions: AssetVersion[]
  activeImageVersionId: string | null
  createdAt: string
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
  /** Selected artistic style preset (ADR-008); picker UI arrives in Slice 5. */
  stylePresetId: string | null
  /** Project references (Slice 10): characters/locations/styles scenes opt into. */
  references: ReferenceAsset[]
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
  /**
   * The prompt sent, kept so async jobs can be finalized after a reload
   * (added in Slice 6; older stored jobs normalize to null).
   */
  prompt: string | null
  /** Actual cost charged at submission, when the provider reports it. */
  submittedCostUsd: number | null
  createdAt: string
  updatedAt: string
}

/** Fill defaults for job fields added after a job was first stored. */
export function normalizeJob(job: GenerationJob): GenerationJob {
  return {
    ...job,
    prompt: job.prompt ?? null,
    submittedCostUsd: job.submittedCostUsd ?? null,
  }
}

export function createProject(title: string, now: () => string): Project {
  const at = now()
  return {
    id: crypto.randomUUID(),
    title,
    format: 'short',
    script: { text: '', locked: false },
    styleNotes: '',
    stylePresetId: null,
    references: [],
    scenes: [],
    costLog: [],
    createdAt: at,
    updatedAt: at,
    schemaVersion: PROJECT_SCHEMA_VERSION,
  }
}

export function createScene(order: number): Scene {
  return {
    id: crypto.randomUUID(),
    order,
    textExcerpt: '',
    visualDescription: '',
    referenceIds: [],
    imageVersions: [],
    activeImageVersionId: null,
    videoVersions: [],
    activeVideoVersionId: null,
    audioVersions: [],
    activeAudioVersionId: null,
  }
}

export function createReference(
  kind: ReferenceKind,
  now: () => string,
): ReferenceAsset {
  return {
    id: crypto.randomUUID(),
    kind,
    name: '',
    descriptor: '',
    imageVersions: [],
    activeImageVersionId: null,
    createdAt: now(),
  }
}

/**
 * Fill defaults for fields added after a project was first stored, so
 * projects saved by older builds load cleanly (additive changes only —
 * breaking changes require a schemaVersion bump + real migration).
 */
export function normalizeProject(project: Project): Project {
  return {
    ...project,
    styleNotes: project.styleNotes ?? '',
    stylePresetId: project.stylePresetId ?? null,
    references: (project.references ?? []).map((reference) => ({
      ...reference,
      imageVersions: reference.imageVersions ?? [],
      activeImageVersionId: reference.activeImageVersionId ?? null,
    })),
    scenes: project.scenes.map((scene) => ({
      ...scene,
      referenceIds: scene.referenceIds ?? [],
      audioVersions: scene.audioVersions ?? [],
      activeAudioVersionId: scene.activeAudioVersionId ?? null,
    })),
  }
}
