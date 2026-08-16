import { useRef, useState } from 'react'
import type { Project } from '../domain/types'
import { useAppStore } from '../state/store'
import { ConfirmDialog } from './ConfirmDialog'

export function ProjectList() {
  const projects = useAppStore((s) => s.projects)
  const createNewProject = useAppStore((s) => s.createNewProject)
  const importProjectFile = useAppStore((s) => s.importProjectFile)
  const importError = useAppStore((s) => s.importError)
  const [title, setTitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <section>
      <h2 style={{ fontSize: 'var(--text-lg)' }}>Projects</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void createNewProject(title)
          setTitle('')
        }}
        style={{ display: 'flex', gap: 'var(--space-2)' }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New project title"
          aria-label="New project title"
        />
        <button type="submit" disabled={title.trim().length === 0}>
          Create project
        </button>
        <button
          type="button"
          onClick={() => {
            fileInputRef.current?.click()
          }}
        >
          Import project (.kairo)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".kairo,application/zip"
          aria-label="Import project file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file !== undefined) void importProjectFile(file)
            e.target.value = ''
          }}
        />
      </form>
      {importError !== null && (
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {importError}
        </p>
      )}
      {projects.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No projects yet. Create one to get started.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {projects.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ProjectRow({ project }: { project: Project }) {
  const select = useAppStore((s) => s.select)
  const renameProject = useAppStore((s) => s.renameProject)
  const removeProject = useAppStore((s) => s.removeProject)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.title)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void renameProject(project.id, draft)
            setEditing(false)
          }}
          style={{ display: 'flex', gap: 'var(--space-2)', flex: 1 }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Project title"
            /* eslint-disable-next-line jsx-a11y/no-autofocus -- utilitarian UI, revisited in design pass */
            autoFocus
          />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={() => select(project.id)}
            style={{
              flex: 1,
              textAlign: 'left',
              background: 'none',
              border: 'none',
              color: 'var(--color-text)',
              fontSize: 'var(--text-base)',
              cursor: 'pointer',
              padding: 'var(--space-2)',
            }}
          >
            {project.title}
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
                marginLeft: 'var(--space-2)',
              }}
            >
              updated {new Date(project.updatedAt).toLocaleString()}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(project.title)
              setEditing(true)
            }}
          >
            Rename
          </button>
          <button type="button" onClick={() => setConfirmingDelete(true)}>
            Delete
          </button>
        </>
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete "${project.title}"?`}
          message="This permanently deletes the project and every generated image and video in it. Assets you paid for cannot be recovered afterwards."
          confirmLabel="Delete project"
          onConfirm={() => {
            void removeProject(project.id)
            setConfirmingDelete(false)
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </li>
  )
}
