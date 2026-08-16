/**
 * Binary asset storage. Real implementation is OPFS (Origin Private File
 * System); the in-memory implementation exists for tests (jsdom has no OPFS)
 * and as a graceful fallback for browsers without OPFS support.
 *
 * Paths are slash-separated, e.g. `<projectId>/<versionId>`.
 */
export interface BlobStore {
  put(path: string, blob: Blob): Promise<void>
  get(path: string): Promise<Blob | null>
  /** Delete everything under a prefix (used when a whole project is deleted). */
  deletePrefix(prefix: string): Promise<void>
  list(prefix: string): Promise<string[]>
}

export class MemoryBlobStore implements BlobStore {
  private readonly blobs = new Map<string, Blob>()

  put(path: string, blob: Blob): Promise<void> {
    this.blobs.set(path, blob)
    return Promise.resolve()
  }

  get(path: string): Promise<Blob | null> {
    return Promise.resolve(this.blobs.get(path) ?? null)
  }

  deletePrefix(prefix: string): Promise<void> {
    for (const key of [...this.blobs.keys()]) {
      if (key === prefix || key.startsWith(`${prefix}/`)) {
        this.blobs.delete(key)
      }
    }
    return Promise.resolve()
  }

  list(prefix: string): Promise<string[]> {
    const result = [...this.blobs.keys()].filter(
      (key) => key === prefix || key.startsWith(`${prefix}/`),
    )
    return Promise.resolve(result.sort())
  }
}

const OPFS_ROOT_DIR = 'kairo-assets'

export class OpfsBlobStore implements BlobStore {
  private async root(create: boolean): Promise<FileSystemDirectoryHandle> {
    const opfs = await navigator.storage.getDirectory()
    return opfs.getDirectoryHandle(OPFS_ROOT_DIR, { create })
  }

  private async dirFor(
    path: string,
    create: boolean,
  ): Promise<{ dir: FileSystemDirectoryHandle; fileName: string }> {
    const segments = path.split('/').filter((s) => s.length > 0)
    const fileName = segments.pop()
    if (fileName === undefined) throw new Error(`Invalid blob path: '${path}'`)
    let dir = await this.root(create)
    for (const segment of segments) {
      dir = await dir.getDirectoryHandle(segment, { create })
    }
    return { dir, fileName }
  }

  async put(path: string, blob: Blob): Promise<void> {
    const { dir, fileName } = await this.dirFor(path, true)
    const file = await dir.getFileHandle(fileName, { create: true })
    const writable = await file.createWritable()
    await writable.write(blob)
    await writable.close()
  }

  async get(path: string): Promise<Blob | null> {
    try {
      const { dir, fileName } = await this.dirFor(path, false)
      const file = await dir.getFileHandle(fileName)
      return await file.getFile()
    } catch {
      return null
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    const segments = prefix.split('/').filter((s) => s.length > 0)
    const last = segments.pop()
    if (last === undefined) return
    try {
      let dir = await this.root(false)
      for (const segment of segments) {
        dir = await dir.getDirectoryHandle(segment)
      }
      await dir.removeEntry(last, { recursive: true })
    } catch {
      // Prefix does not exist — nothing to delete.
    }
  }

  async list(prefix: string): Promise<string[]> {
    const segments = prefix.split('/').filter((s) => s.length > 0)
    try {
      let dir = await this.root(false)
      for (const segment of segments) {
        dir = await dir.getDirectoryHandle(segment)
      }
      const paths: string[] = []
      await collect(dir, prefix, paths)
      return paths.sort()
    } catch {
      return []
    }
  }
}

async function collect(
  dir: FileSystemDirectoryHandle,
  base: string,
  out: string[],
): Promise<void> {
  for await (const [name, handle] of dir.entries()) {
    const path = base.length > 0 ? `${base}/${name}` : name
    if (handle.kind === 'file') {
      out.push(path)
    } else {
      await collect(handle as FileSystemDirectoryHandle, path, out)
    }
  }
}

export function createBlobStore(): BlobStore {
  const opfsAvailable =
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage.getDirectory === 'function'
  return opfsAvailable ? new OpfsBlobStore() : new MemoryBlobStore()
}
