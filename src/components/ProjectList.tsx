import { useRef, useState } from 'react'
import type { Project } from '../domain/types'
import { useAppStore } from '../state/store'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * Projects as a poster wall (ADR-011, Filmstrip design): every project is a
 * one-sheet — a 9:16 poster with its title on the plate. No artwork exists
 * until images are generated, so each poster wears a deterministic gradient
 * mixed from the theme's own bubble colors.
 */

/** Stable tiny hash so a project keeps its poster art between visits. */
function posterSeed(id: string): number {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997
  return h
}

function posterBackground(id: string): string {
  const seed = posterSeed(id)
  const angle = 140 + (seed % 60)
  const coolStop = 25 + (seed % 30)
  return `linear-gradient(${String(angle)}deg, rgba(var(--bubble-cool), 0.85) 0%, rgba(var(--bubble-warm), 0.55) ${String(coolStop + 35)}%, var(--color-bg) 100%)`
}

export function ProjectList() {
  const projects = useAppStore((s) => s.projects)
  const createNewProject = useAppStore((s) => s.createNewProject)
  const importProjectFile = useAppStore((s) => s.importProjectFile)
  const importError = useAppStore((s) => s.importError)
  const [title, setTitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--space-3)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>
            Your productions
          </h2>
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            posters on the wall — newest first
          </span>
        </div>
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
          <button
            type="submit"
            className="primary"
            disabled={title.trim().length === 0}
          >
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
      </div>
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
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(13rem, 1fr))',
            gap: 'var(--space-6) var(--space-4)',
          }}
        >
          {projects.map((project) => (
            <PosterCard key={project.id} project={project} />
          ))}
        </ul>
      )}
    </section>
  )
}

function PosterCard({ project }: { project: Project }) {
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
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      <button
        type="button"
        onClick={() => select(project.id)}
        style={{
          padding: 0,
          border: '1px solid var(--color-border)',
          borderRadius: '18px',
          overflow: 'hidden',
          position: 'relative',
          aspectRatio: '9 / 16',
          width: '100%',
          background: posterBackground(project.id),
          boxShadow: 'var(--shadow-card)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: 'var(--space-3) var(--space-3)',
            background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.7))',
            display: 'block',
          }}
        >
          <span
            style={{
              display: 'block',
              fontWeight: 700,
              fontSize: 'var(--text-base)',
              color: '#ffffff',
            }}
          >
            {project.title}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.75)',
              marginTop: '2px',
            }}
          >
            updated {new Date(project.updatedAt).toLocaleString()}
          </span>
        </span>
      </button>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void renameProject(project.id, draft)
            setEditing(false)
          }}
          style={{ display: 'flex', gap: 'var(--space-2)' }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Project title"
            style={{ minWidth: 0, flex: 1 }}
            /* eslint-disable-next-line jsx-a11y/no-autofocus -- inline rename, focus follows intent */
            autoFocus
          />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-2)',
          }}
        >
          <button
            type="button"
            style={{
              fontSize: 'var(--text-sm)',
              padding: 'var(--space-1) var(--space-3)',
            }}
            onClick={() => {
              setDraft(project.title)
              setEditing(true)
            }}
          >
            Rename
          </button>
          <button
            type="button"
            style={{
              fontSize: 'var(--text-sm)',
              padding: 'var(--space-1) var(--space-3)',
            }}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </button>
        </div>
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
