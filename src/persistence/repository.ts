import { normalizeJob, normalizeProject } from '../domain/types'
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
    const project = await this.db.get('projects', id)
    return project === undefined ? undefined : normalizeProject(project)
  }

  async listProjects(): Promise<Project[]> {
    const all = await this.db.getAll('projects')
    return all
      .map(normalizeProject)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
    const jobs = await this.db.getAllFromIndex('jobs', 'by-project', projectId)
    return jobs.map(normalizeJob)
  }

  async listAllJobs(): Promise<GenerationJob[]> {
    const jobs = await this.db.getAll('jobs')
    return jobs.map(normalizeJob)
  }
}
