import { create } from 'zustand'
import { createProject, type Project } from '../domain/types'
import { getRepository } from './repo'

const nowIso = () => new Date().toISOString()

interface AppState {
  loaded: boolean
  projects: Project[]
  selectedProjectId: string | null
  init: () => Promise<void>
  createNewProject: (title: string) => Promise<void>
  renameProject: (id: string, title: string) => Promise<void>
  removeProject: (id: string) => Promise<void>
  select: (id: string | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  loaded: false,
  projects: [],
  selectedProjectId: null,

  init: async () => {
    const repo = await getRepository()
    set({ projects: await repo.listProjects(), loaded: true })
  },

  createNewProject: async (title: string) => {
    const trimmed = title.trim()
    if (trimmed.length === 0) return
    const repo = await getRepository()
    const project = createProject(trimmed, nowIso)
    await repo.putProject(project)
    set({ projects: await repo.listProjects() })
  },

  renameProject: async (id: string, title: string) => {
    const trimmed = title.trim()
    if (trimmed.length === 0) return
    const repo = await getRepository()
    const project = await repo.getProject(id)
    if (project === undefined) return
    await repo.putProject({ ...project, title: trimmed, updatedAt: nowIso() })
    set({ projects: await repo.listProjects() })
  },

  removeProject: async (id: string) => {
    const repo = await getRepository()
    await repo.deleteProject(id)
    const { selectedProjectId } = get()
    set({
      projects: await repo.listProjects(),
      selectedProjectId: selectedProjectId === id ? null : selectedProjectId,
    })
  },

  select: (id: string | null) => {
    set({ selectedProjectId: id })
  },
}))
