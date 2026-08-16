import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import {
  normalizeProject,
  PROJECT_SCHEMA_VERSION,
  type Project,
} from '../domain/types'
import type { BlobStore } from './blobStore'

/**
 * Project export/import as a single `.kairo` file — a zip containing:
 *   project.json          the Project document
 *   assets/<blobPath>     every stored asset binary
 *
 * "Never lose paid assets": export must always be possible, including for
 * half-finished projects, and must round-trip every version blob.
 */

export const PROJECT_FILE_EXTENSION = '.kairo'

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectFileError'
  }
}

export async function exportProject(
  project: Project,
  blobs: BlobStore,
): Promise<Blob> {
  const files: Record<string, Uint8Array> = {
    'project.json': strToU8(JSON.stringify(project, null, 2)),
  }
  for (const path of await blobs.list(project.id)) {
    const blob = await blobs.get(path)
    if (blob !== null) {
      files[`assets/${path}`] = new Uint8Array(await blob.arrayBuffer())
    }
  }
  const zipped = zipSync(files)
  const bytes = new Uint8Array(zipped.length)
  bytes.set(zipped)
  return new Blob([bytes.buffer], { type: 'application/zip' })
}

/**
 * Imports a `.kairo` file. The project gets a NEW id (so importing next to an
 * existing copy never collides); asset blob paths are re-rooted accordingly.
 */
export async function importProject(
  file: Blob,
  blobs: BlobStore,
): Promise<Project> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new ProjectFileError('Not a valid .kairo file (unreadable archive).')
  }

  const projectJson = entries['project.json']
  if (projectJson === undefined) {
    throw new ProjectFileError(
      'Not a valid .kairo file (missing project.json).',
    )
  }

  let parsed: Project
  try {
    parsed = JSON.parse(strFromU8(projectJson)) as Project
  } catch {
    throw new ProjectFileError(
      'Not a valid .kairo file (corrupt project.json).',
    )
  }
  if (parsed.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new ProjectFileError(
      `Unsupported project schema version: ${String(parsed.schemaVersion)}.`,
    )
  }

  const oldId = parsed.id
  const newId = crypto.randomUUID()
  parsed = normalizeProject(parsed)
  const rerooted: Project = {
    ...parsed,
    id: newId,
    scenes: parsed.scenes.map((scene) => ({
      ...scene,
      imageVersions: scene.imageVersions.map((v) => ({
        ...v,
        blobPath: rerootPath(v.blobPath, oldId, newId),
      })),
      videoVersions: scene.videoVersions.map((v) => ({
        ...v,
        blobPath: rerootPath(v.blobPath, oldId, newId),
      })),
    })),
  }

  for (const [entryPath, bytes] of Object.entries(entries)) {
    if (!entryPath.startsWith('assets/')) continue
    const blobPath = rerootPath(entryPath.slice('assets/'.length), oldId, newId)
    const copy = new Uint8Array(bytes.length)
    copy.set(bytes)
    await blobs.put(blobPath, new Blob([copy.buffer]))
  }

  return rerooted
}

function rerootPath(path: string, oldId: string, newId: string): string {
  return path === oldId || path.startsWith(`${oldId}/`)
    ? `${newId}${path.slice(oldId.length)}`
    : path
}
