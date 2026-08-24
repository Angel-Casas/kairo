/**
 * Kairo domain model.
 *
 * Principles encoded here (see CLAUDE.md):
 * - Never lose paid assets: versions are append-only arrays, never overwritten.
 * - Everything is resumable: in-flight generations are persisted GenerationJobs.
 * - Cost transparency: every generation is recorded in the project's cost log.
 */

/**
 * The project's video format (Slice 18). Metadata (ratio, API parameter,
 * prompt fragment) lives in domain/formats.ts; the ids live here so the
 * Project type has no dependency on presentation strings. The pre-18
 * placeholder value 'short' is healed to 'vertical' in normalizeProject.
 */
export const PROJECT_FORMAT_IDS = [
  'vertical',
  'widescreen',
  'square',
  'portrait',
  'cinematic',
] as const

export type ProjectFormat = (typeof PROJECT_FORMAT_IDS)[number]

export const DEFAULT_PROJECT_FORMAT: ProjectFormat = 'vertical'

function healFormat(format: unknown): ProjectFormat {
  return (PROJECT_FORMAT_IDS as readonly string[]).includes(format as string)
    ? (format as ProjectFormat)
    : DEFAULT_PROJECT_FORMAT
}

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
  /**
   * Set on lip-sync clips (15.16.3): the narration is baked into the
   * clip's own audio track, so narration-pairing features (side player,
   * lightbox sync, export narration files) must NOT double it.
   */
  embedsNarration?: boolean
  /**
   * The user's own call (20.2): silence the side narration for this take,
   * everywhere — workbench, lightbox, premiere, and export files. Unlike
   * embedsNarration (set automatically on lip-sync takes) this is a manual,
   * reversible choice that persists with the project.
   */
  narrationSilenced?: boolean
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
  /**
   * Optional camera direction for the Animation stage (position, panning,
   * zoom — e.g. "fixed tripod", "slow push-in"). Woven into the video
   * prompt; empty means the default gentle drift.
   */
  cameraNotes: string
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
  /** Lip-sync jobs: the finished clip embeds the narration (15.16.3). */
  embedsNarration?: boolean
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

export function createProject(
  title: string,
  now: () => string,
  format: ProjectFormat = DEFAULT_PROJECT_FORMAT,
): Project {
  const at = now()
  return {
    id: crypto.randomUUID(),
    title,
    format,
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
    cameraNotes: '',
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
/**
 * Media versions must carry a MIME type of their own kind: OPFS strips
 * types on read, so display re-wraps blobs with the stored one (see
 * useBlobUrl). Early builds stored whatever Content-Type the CDN sent —
 * sometimes `application/octet-stream` — which leaves a real video
 * unplayable. Heal such versions to their kind's default container.
 */
function healMimeType(version: AssetVersion): AssetVersion {
  const family =
    version.kind === 'video'
      ? 'video/'
      : version.kind === 'audio'
        ? 'audio/'
        : 'image/'
  if (version.mimeType.startsWith(family)) return version
  const fallback =
    version.kind === 'video'
      ? 'video/mp4'
      : version.kind === 'audio'
        ? 'audio/mpeg'
        : 'image/png'
  return { ...version, mimeType: fallback }
}

/**
 * True when a clip's own audio is the whole soundtrack — the narration
 * must not be layered on top of it anywhere (20.2): lip-sync takes carry
 * it automatically, and the user can silence any take by hand.
 */
export function clipCarriesOwnAudio(
  version:
    | Pick<AssetVersion, 'embedsNarration' | 'narrationSilenced'>
    | null
    | undefined,
): boolean {
  return (
    version?.embedsNarration === true || version?.narrationSilenced === true
  )
}

export function normalizeProject(project: Project): Project {
  return {
    ...project,
    format: healFormat(project.format),
    styleNotes: project.styleNotes ?? '',
    stylePresetId: project.stylePresetId ?? null,
    references: (project.references ?? []).map((reference) => ({
      ...reference,
      imageVersions: (reference.imageVersions ?? []).map(healMimeType),
      activeImageVersionId: reference.activeImageVersionId ?? null,
    })),
    scenes: project.scenes.map((scene) => ({
      ...scene,
      referenceIds: scene.referenceIds ?? [],
      cameraNotes: scene.cameraNotes ?? '',
      imageVersions: scene.imageVersions.map(healMimeType),
      videoVersions: scene.videoVersions.map(healMimeType),
      audioVersions: (scene.audioVersions ?? []).map(healMimeType),
      activeAudioVersionId: scene.activeAudioVersionId ?? null,
    })),
  }
}
