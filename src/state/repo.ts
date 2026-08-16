import { createBlobStore } from '../persistence/blobStore'
import { openKairoDB } from '../persistence/db'
import { Repository } from '../persistence/repository'

let repositoryPromise: Promise<Repository> | null = null

export function getRepository(): Promise<Repository> {
  repositoryPromise ??= openKairoDB().then(
    (db) => new Repository(db, createBlobStore()),
  )
  return repositoryPromise
}

/** Test-only: drop the cached repository so a fresh IndexedDB is opened. */
export function __resetRepositoryForTests(): void {
  repositoryPromise = null
}
