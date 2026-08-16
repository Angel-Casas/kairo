import type { GenerationJob, Project } from '../domain/types'
import type { BlobStore } from './blobStore'
import type { KairoDB } from './db'

/**
 * All reads/writes of projects and jobs go through this repository so the
 * UI never touches IndexedDB or OPFS directly.
 */
export class Repository {
  private readonly db: KairoDB
  readonly blobs: BlobStore

  constructor(db: KairoDB, blobs: BlobStore) {
    this.db = db
    this.blobs = blobs
  }

  // -- Projects ------------------------------------------------------------

  async putProject(project: Project): Promise<void> {
    await this.db.put('projects', project)
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.db.get('projects', id)
  }

  async listProjects(): Promise<Project[]> {
    const all = await this.db.getAll('projects')
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  /**
   * Deletes a project AND its jobs AND its stored assets. Destructive —
   * callers must have shown the user an explicit confirmation first.
   */
  async deleteProject(id: string): Promise<void> {
    const tx = this.db.transaction(['projects', 'jobs'], 'readwrite')
    await tx.objectStore('projects').delete(id)
    const jobsStore = tx.objectStore('jobs')
    for (const job of await jobsStore.index('by-project').getAll(id)) {
      await jobsStore.delete(job.id)
    }
    await tx.done
    await this.blobs.deletePrefix(id)
  }

  // -- Jobs ----------------------------------------------------------------

  async putJob(job: GenerationJob): Promise<void> {
    await this.db.put('jobs', job)
  }

  async getJobsByProject(projectId: string): Promise<GenerationJob[]> {
    return this.db.getAllFromIndex('jobs', 'by-project', projectId)
  }

  async listAllJobs(): Promise<GenerationJob[]> {
    return this.db.getAll('jobs')
  }
}
