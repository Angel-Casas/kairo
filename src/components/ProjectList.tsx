import { useRef, useState } from 'react'
import { getFormatSpec, VIDEO_FORMATS } from '../domain/formats'
import type { Project, ProjectFormat } from '../domain/types'
import { useT } from '../i18n'
import { useAppStore } from '../state/store'
import { ConfirmDialog } from './ConfirmDialog'
import { KairoMark } from './KairoMark'
import { useBlobUrl } from './useBlobUrl'

/**
 * Projects as a poster wall (ADR-011, Filmstrip design): every project is a
 * one-sheet — a poster in the project's own format, its title on the
 * plate. A project with generated artwork wears its OWN opening frame
 * (22.17, Angel's report: every poster looked the same); before any
 * image exists, each poster gets a deterministic aurora mixed from the
 * six ring pastels — seeded by the project id, so no two posters match
 * and each keeps its art between visits — under a faint Kairo mark.
 */

/** Stable tiny hash so a project keeps its poster art between visits. */
function posterSeed(id: string): number {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997
  return h
}

function posterBackground(id: string): string {
  const seed = posterSeed(id)
  // Three of the six ring pastels, spread so neighbours rarely rhyme.
  const a = (seed % 6) + 1
  const b = ((seed + 2 + (seed % 3)) % 6) + 1
  const c = ((seed + 4) % 6) + 1
  const angle = 100 + (seed % 140)
  const x = 12 + (seed % 70)
  const y = 8 + (Math.floor(seed / 7) % 40)
  return [
    `radial-gradient(120% 90% at ${String(x)}% ${String(y)}%, color-mix(in srgb, var(--ring-${String(a)}) 88%, transparent) 0%, transparent 60%)`,
    `radial-gradient(150% 110% at ${String(100 - x)}% 88%, color-mix(in srgb, var(--ring-${String(c)}) 72%, transparent) 0%, transparent 68%)`,
    `linear-gradient(${String(angle)}deg, var(--ring-${String(b)}) 0%, var(--color-bg) 135%)`,
  ].join(', ')
}

/** The project's opening frame: the first scene with an active image. */
function heroImage(project: Project) {
  return (
    [...project.scenes]
      .sort((a, b) => a.order - b.order)
      .map(
        (s) =>
          s.imageVersions.find((v) => v.id === s.activeImageVersionId) ?? null,
      )
      .find((v) => v !== null) ?? null
  )
}

export function ProjectList() {
  const projects = useAppStore((s) => s.projects)
  const createNewProject = useAppStore((s) => s.createNewProject)
  const importProjectFile = useAppStore((s) => s.importProjectFile)
  const importError = useAppStore((s) => s.importError)
  const [title, setTitle] = useState('')
  const [format, setFormat] = useState<ProjectFormat>('vertical')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const t = useT()

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
            {t('Your productions')}
          </h2>
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {t('posters on the wall — newest first')}
          </span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void createNewProject(title, format)
            setTitle('')
          }}
          style={{ display: 'flex', gap: 'var(--space-2)' }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('New project title')}
            aria-label="New project title"
          />
          <select
            aria-label="Video format"
            value={format}
            onChange={(e) => setFormat(e.target.value as ProjectFormat)}
          >
            {VIDEO_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {t(f.name)} {f.ratioLabel} — {t(f.hint)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="primary"
            disabled={title.trim().length === 0}
          >
            {t('Create project')}
          </button>
          <button
            type="button"
            onClick={() => {
              fileInputRef.current?.click()
            }}
          >
            {t('Import project (.kairo)')}
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
          {t('No projects yet. Create one to get started.')}
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
  const t = useT()
  const select = useAppStore((s) => s.select)
  const renameProject = useAppStore((s) => s.renameProject)
  const removeProject = useAppStore((s) => s.removeProject)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.title)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const hero = heroImage(project)
  const heroUrl = useBlobUrl(hero?.blobPath ?? null, hero?.mimeType)
  const sceneCount = project.scenes.length
  const clipCount = project.scenes.filter(
    (s) => s.activeVideoVersionId !== null,
  ).length

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
        className="poster-card"
        onClick={() => select(project.id)}
        style={{
          padding: 0,
          border: '1px solid var(--color-border)',
          borderRadius: '18px',
          overflow: 'hidden',
          position: 'relative',
          aspectRatio: getFormatSpec(project.format).cssAspect,
          width: '100%',
          background: posterBackground(project.id),
          boxShadow: 'var(--shadow-card)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {heroUrl !== null ? (
          <img
            src={heroUrl}
            alt=""
            aria-hidden="true"
            className="poster-art"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          // No artwork yet: the aurora shows through, watermarked with
          // a faint projector K so the empty poster still feels ours.
          <span
            aria-hidden="true"
            className="poster-mark"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.5)',
              opacity: 0.55,
            }}
          >
            <KairoMark size={64} spark="rgba(255, 255, 255, 0.75)" />
          </span>
        )}
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
            {getFormatSpec(project.format).ratioLabel}
            {sceneCount > 0 &&
              ` · ${String(sceneCount)} ${sceneCount === 1 ? t('scene') : t('scenes')}`}
            {clipCount > 0 &&
              ` · ${String(clipCount)} ${clipCount === 1 ? t('clip') : t('clips')}`}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.6)',
              marginTop: '2px',
            }}
          >
            {t('updated {when}', {
              when: new Date(project.updatedAt).toLocaleString(),
            })}
          </span>
        </span>
        {/* Fades in with the hover lift — the poster says what a click does. */}
        <span
          className="poster-open-hint"
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 'var(--space-3)',
            right: 'var(--space-3)',
            color: '#ffffff',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            textShadow: '0 1px 8px rgba(0, 0, 0, 0.7)',
          }}
        >
          {t('Open →')}
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
          <button type="submit">{t('Save')}</button>
          <button type="button" onClick={() => setEditing(false)}>
            {t('Cancel')}
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
            {t('Rename')}
          </button>
          <button
            type="button"
            style={{
              fontSize: 'var(--text-sm)',
              padding: 'var(--space-1) var(--space-3)',
            }}
            onClick={() => setConfirmingDelete(true)}
          >
            {t('Delete')}
          </button>
        </div>
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title={t('Delete "{title}"?', { title: project.title })}
          message={t(
            'This permanently deletes the project and every generated image and video in it. Assets you paid for cannot be recovered afterwards.',
          )}
          confirmLabel={t('Delete project')}
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
