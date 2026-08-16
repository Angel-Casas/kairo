import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { GenerationJob, Project } from '../domain/types'

export const DB_NAME = 'kairo'
export const DB_VERSION = 1

export interface KairoDBSchema extends DBSchema {
  projects: { key: string; value: Project }
  jobs: {
    key: string
    value: GenerationJob
    indexes: { 'by-project': string }
  }
}

export type KairoDB = IDBPDatabase<KairoDBSchema>

export function openKairoDB(name: string = DB_NAME): Promise<KairoDB> {
  return openDB<KairoDBSchema>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Migration scaffold: each block upgrades one schema version.
      // Never edit an existing block — add a new one below it.
      if (oldVersion < 1) {
        db.createObjectStore('projects', { keyPath: 'id' })
        const jobs = db.createObjectStore('jobs', { keyPath: 'id' })
        jobs.createIndex('by-project', 'projectId')
      }
      // if (oldVersion < 2) { ... }
    },
  })
}
